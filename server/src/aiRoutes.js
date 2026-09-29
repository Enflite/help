import express from "express";
import mongoose from "mongoose";
import { AiClient } from "./aiClient.js";
import { AiSession } from "./models/AiSession.js";

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const dbUp = () => mongoose.connection.readyState === 1;

// The upstream /chat conversation for this anonymous browser session, if we already have one.
// Never throws: without a database the proxy simply starts a fresh upstream conversation each time.
async function findConversationId(sessionKey) {
  if (!dbUp()) return null;
  try {
    const doc = await AiSession.findOne({ sessionKey }, "conversationId").lean();
    return doc?.conversationId || null;
  } catch {
    return null;
  }
}

async function rememberConversationId(sessionKey, conversationId) {
  if (!dbUp() || !conversationId) return;
  try {
    await AiSession.findOneAndUpdate(
      { sessionKey },
      { sessionKey, conversationId },
      { upsert: true, setDefaultsOnInsert: true },
    );
  } catch {
    // Session persistence is a convenience; a lost mapping just starts a new conversation.
  }
}

// Upstream SSE framing: `event: <name>\ndata: <json>\n\n`, with bare `: ` heartbeat comments.
function eachSseBlock(text) {
  const blocks = [];
  let rest = text;
  let idx;
  while ((idx = rest.indexOf("\n\n")) !== -1) {
    blocks.push(rest.slice(0, idx));
    rest = rest.slice(idx + 2);
  }
  return { blocks, rest };
}

function parseSseBlock(block) {
  if (block.startsWith(":")) return null; // heartbeat comment
  let event = null;
  const data = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  return event ? { event, data: data.join("\n") } : null;
}

const errorFrame = (message, code = "UPSTREAM_UNAVAILABLE") =>
  `event: error\ndata: ${JSON.stringify({ code, message })}\n\n`;

export function createAiRouter({ ai } = {}) {
  const client = ai instanceof AiClient ? ai : new AiClient(ai);
  const router = express.Router();
  router.use(express.json({ limit: "64kb" }));

  router.get("/status", (req, res) => {
    res.json({ enabled: client.isConfigured() });
  });

  router.post("/chat", wrap(async (req, res) => {
    if (!client.isConfigured()) {
      return res.status(503).json({ error: "AI assistant is not configured" });
    }
    const { sessionKey, content } = req.body ?? {};
    if (typeof sessionKey !== "string" || sessionKey.length < 8) {
      return res.status(400).json({ error: "sessionKey is required" });
    }
    if (typeof content !== "string" || content.length < 1 || content.length > 32000) {
      return res.status(400).json({ error: "content must be 1..32000 characters" });
    }

    // Strict whitelist: the upstream body is `.strict()` and rejects unknown keys.
    const upstreamBody = { content };
    const conversationId = await findConversationId(sessionKey);
    if (conversationId) upstreamBody.conversationId = conversationId;

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    let upstreamRes;
    try {
      upstreamRes = await client.chat(upstreamBody);
    } catch {
      res.write(errorFrame("The AI assistant is unavailable right now. Please try again later."));
      return res.end();
    }

    if (!upstreamRes.ok || !upstreamRes.body) {
      res.write(errorFrame("The AI assistant is unavailable right now. Please try again later."));
      return res.end();
    }

    const reader = upstreamRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let closed = false;
    req.on("close", () => {
      closed = true;
      reader.cancel().catch(() => {});
    });

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (!closed) res.write(chunk);
        buffer += chunk;
        const { blocks, rest } = eachSseBlock(buffer);
        buffer = rest;
        for (const block of blocks) {
          const parsed = parseSseBlock(block);
          if (parsed?.event === "meta") {
            try {
              const meta = JSON.parse(parsed.data);
              if (typeof meta.conversationId === "string") {
                await rememberConversationId(sessionKey, meta.conversationId);
              }
            } catch {
              // Not valid meta JSON; the frame still went to the client verbatim.
            }
          }
        }
        if (closed) break;
      }
    } catch {
      if (!closed) res.write(errorFrame("The AI assistant is unavailable right now. Please try again later."));
    }
    if (!closed) res.end();
  }));

  return router;
}
