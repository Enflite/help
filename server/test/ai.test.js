// AI chat proxy tests. The upstream backend-ai is mocked with node:http; no MongoDB is needed
// for the proxy logic. The AiSession persistence test uses MONGODB_URI_TEST and is skipped when
// no MongoDB answers (same pattern as api.test.js).
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import http from "node:http";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { AiSession } from "../src/models/AiSession.js";

const CONVERSATION_ID = "11111111-2222-3333-4444-555555555555";

const fakeJwt = (expSeconds = 900) => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none" })}.${b64({ exp: Math.floor(Date.now() / 1000) + expSeconds })}.sig`;
};

// Mock upstream backend-ai. opts.failChatOnce makes the first /chat call 401.
function startMockUpstream({ failChatOnce = false } = {}) {
  const calls = { logins: 0, chats: [] };
  let token = fakeJwt();
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.url === "/api/v1/auth/login" && req.method === "POST") {
        calls.logins += 1;
        token = fakeJwt();
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ accessToken: token }));
      }
      if (req.url === "/api/v1/chat" && req.method === "POST") {
        const auth = req.headers.authorization || "";
        const parsed = JSON.parse(body);
        calls.chats.push({ auth, body: parsed });
        if (failChatOnce && calls.chats.length === 1) {
          res.writeHead(401);
          return res.end();
        }
        if (auth !== `Bearer ${token}`) {
          res.writeHead(401);
          return res.end();
        }
        res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8" });
        res.end(
          `event: meta\ndata: {"conversationId":"${CONVERSATION_ID}"}\n\n` +
            `: heartbeat\n\n` +
            `event: delta\ndata: {"content":"Hello"}\n\n` +
            `event: delta\ndata: {"content":" world"}\n\n` +
            `event: notice\ndata: {"code":"PRIVACY_ROUTING","message":"Kept on the local model for privacy."}\n\n` +
            `event: done\ndata: {}\n\n`,
        );
        return;
      }
      res.writeHead(404);
      res.end();
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, calls, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

const aiConfig = (url) => ({ apiUrl: url, email: "help-site@example.com", password: "secret" });

function startApp(appOptions) {
  return new Promise((resolve) => {
    const server = createApp(appOptions).listen(0, "127.0.0.1", () =>
      resolve({ server, base: `http://127.0.0.1:${server.address().port}` }),
    );
  });
}

async function sseText(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text;
}

const postChat = (base, payload) =>
  fetch(`${base}/api/ai/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

// --- status / disabled -------------------------------------------------------

test("status reports disabled when the AI is not configured", async () => {
  const { server: appServer, base } = await startApp({});
  try {
    const res = await fetch(`${base}/api/ai/status`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { enabled: false });
  } finally {
    appServer.close();
  }
});

test("chat returns 503 when the AI is not configured", async () => {
  const { server: appServer, base } = await startApp({});
  try {
    const res = await postChat(base, { sessionKey: "12345678", content: "hi" });
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: "AI assistant is not configured" });
  } finally {
    appServer.close();
  }
});

test("chat validates its input", async () => {
  const { server, url } = await startMockUpstream();
  const { server: appServer, base } = await startApp({ aiConfig: aiConfig(url) });
  try {
    assert.equal((await postChat(base, { content: "hi" })).status, 400); // no sessionKey
    assert.equal((await postChat(base, { sessionKey: "short", content: "hi" })).status, 400);
    assert.equal((await postChat(base, { sessionKey: "12345678", content: "" })).status, 400);
    assert.equal((await postChat(base, { sessionKey: "12345678", content: "x".repeat(32001) })).status, 400);
  } finally {
    appServer.close();
    server.close();
  }
});

// --- proxy behavior ----------------------------------------------------------

test("chat proxies upstream SSE frames verbatim", async () => {
  const { server, url, calls } = await startMockUpstream();
  const { server: appServer, base } = await startApp({ aiConfig: aiConfig(url) });
  try {
    const res = await postChat(base, { sessionKey: "aaaabbbb-cccc", content: "hello" });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/event-stream/);
    const text = await sseText(res);
    assert.ok(text.includes('event: delta\ndata: {"content":"Hello"}'));
    assert.ok(text.includes('event: notice\ndata: {"code":"PRIVACY_ROUTING"'));
    assert.ok(text.includes("event: done"));
    assert.ok(!text.includes("secret"), "credentials never leak into the stream");
    assert.equal(calls.logins, 1);
  } finally {
    appServer.close();
    server.close();
  }
});

test("only whitelisted fields reach the upstream (strict body)", async () => {
  const { server, url, calls } = await startMockUpstream();
  const { server: appServer, base } = await startApp({ aiConfig: aiConfig(url) });
  try {
    const res = await postChat(base, {
      sessionKey: "aaaabbbb-cccc",
      content: "hi",
      modelId: "nope",
      classification: "nope",
      extra: { nested: true },
    });
    assert.equal(res.status, 200);
    await sseText(res);
    assert.deepEqual(calls.chats[0].body, { content: "hi" });
  } finally {
    appServer.close();
    server.close();
  }
});

test("a 401 from upstream triggers one re-login and retry", async () => {
  const { server, url, calls } = await startMockUpstream({ failChatOnce: true });
  const { server: appServer, base } = await startApp({ aiConfig: aiConfig(url) });
  try {
    const res = await postChat(base, { sessionKey: "aaaabbbb-cccc", content: "hi" });
    assert.equal(res.status, 200);
    const text = await sseText(res);
    assert.ok(text.includes("event: done"));
    assert.equal(calls.logins, 2, "logged in again after the 401");
    assert.equal(calls.chats.length, 2, "retried the chat once");
  } finally {
    appServer.close();
    server.close();
  }
});

test("the login token is reused across chats", async () => {
  const { server, url, calls } = await startMockUpstream();
  const { server: appServer, base } = await startApp({ aiConfig: aiConfig(url) });
  try {
    for (const key of ["key-one-111", "key-two-222"]) {
      const res = await postChat(base, { sessionKey: key, content: "hi" });
      assert.equal(res.status, 200);
      await sseText(res);
    }
    assert.equal(calls.logins, 1, "one login for both chats");
  } finally {
    appServer.close();
    server.close();
  }
});

test("upstream transport failure ends the stream with an error event", async () => {
  const { server, url } = await startMockUpstream();
  const deadUrl = url;
  server.close();
  const { server: appServer, base } = await startApp({ aiConfig: aiConfig(deadUrl) });
  try {
    const res = await postChat(base, { sessionKey: "aaaabbbb-cccc", content: "hi" });
    assert.equal(res.status, 200); // SSE, so the failure arrives as an error frame
    const text = await sseText(res);
    assert.ok(text.includes("event: error"));
    assert.ok(text.includes("UPSTREAM_UNAVAILABLE"));
    assert.ok(!text.includes("ECONNREFUSED"));
  } finally {
    appServer.close();
  }
});

// --- AiSession persistence (needs MongoDB) -----------------------------------

const mongoUri = process.env.MONGODB_URI_TEST || "mongodb://127.0.0.1:27017/enflite-help-test";
let mongoSkip = false;

before(async () => {
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
    await mongoose.connection.db.collection("aisessions").deleteMany({});
  } catch {
    mongoSkip = "no MongoDB at " + mongoUri;
  }
});

after(async () => {
  if (!mongoSkip) {
    await mongoose.connection.db.collection("aisessions").deleteMany({});
  }
  await mongoose.disconnect().catch(() => {});
});

const mt = (name, fn) => test(name, (ctx) => (mongoSkip ? ctx.skip(mongoSkip) : fn()));

mt("the session mapping reuses the upstream conversation", async () => {
  const { server, url, calls } = await startMockUpstream();
  const { server: appServer, base } = await startApp({ aiConfig: aiConfig(url) });
  try {
    const sessionKey = `test-${Date.now()}`;
    const first = await postChat(base, { sessionKey, content: "first" });
    assert.equal(first.status, 200);
    await sseText(first);
    const second = await postChat(base, { sessionKey, content: "second" });
    assert.equal(second.status, 200);
    await sseText(second);
    assert.deepEqual(calls.chats[0].body, { content: "first" });
    assert.deepEqual(calls.chats[1].body, { content: "second", conversationId: CONVERSATION_ID });
    const doc = await AiSession.findOne({ sessionKey }).lean();
    assert.equal(doc.conversationId, CONVERSATION_ID);
  } finally {
    appServer.close();
    server.close();
  }
});
