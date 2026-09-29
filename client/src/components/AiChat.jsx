import { useEffect, useRef, useState } from "react";
import { getJson } from "../api.js";

const SESSION_KEY = "enflite-help-ai-session";

function sessionKey() {
  let key = null;
  try {
    key = localStorage.getItem(SESSION_KEY);
  } catch {
    key = null;
  }
  if (!key) {
    key = crypto.randomUUID();
    try {
      localStorage.setItem(SESSION_KEY, key);
    } catch {
      // private mode: the chat still works, it just won't keep its thread
    }
  }
  return key;
}

// Floating "Ask Enflite AI" launcher plus slide-over chat panel. Rendered on every page by
// Layout. Hidden entirely while the server reports the assistant as not configured.
export default function AiChat() {
  const [enabled, setEnabled] = useState(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // { role: "user"|"ai", text, notices: [] }
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [failed, setFailed] = useState(null); // last failed user message, for Retry
  const streamRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    getJson("/api/ai/status")
      .then((s) => setEnabled(Boolean(s.enabled)))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  useEffect(() => () => streamRef.current?.abort(), []);

  function parseFrames(text, onFrame) {
    // Upstream SSE framing: `event: <name>\ndata: <json>\n\n`, bare `: ` heartbeat comments.
    const blocks = text.split("\n\n");
    const rest = blocks.pop();
    for (const block of blocks) {
      if (block.startsWith(":") || !block.trim()) continue;
      let event = null;
      const data = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      if (event) onFrame(event, data.join("\n"));
    }
    return rest;
  }

  async function send(text, { retryOf } = {}) {
    const content = text.trim();
    if (!content || streaming) return;
    setFailed(null);
    setInput("");
    setStreaming(true);
    const key = sessionKey();
    if (retryOf) {
      setMessages((m) => m.slice(0, -1)); // drop the failed assistant message
    } else {
      setMessages((m) => [...m, { role: "user", text: content, notices: [] }]);
    }
    setMessages((m) => [...m, { role: "ai", text: "", notices: [] }]);
    const controller = new AbortController();
    streamRef.current = controller;
    let buffer = "";
    let gotContent = false;
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionKey: key, content }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`chat ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer = parseFrames(buffer + decoder.decode(value, { stream: true }), (event, data) => {
          if (event === "delta") {
            let chunk = "";
            try {
              chunk = JSON.parse(data).content || "";
            } catch {
              chunk = "";
            }
            if (chunk) {
              gotContent = true;
              setMessages((m) => {
                const next = m.slice();
                next[next.length - 1] = { ...next[next.length - 1], text: next[next.length - 1].text + chunk };
                return next;
              });
            }
          } else if (event === "notice") {
            let message = "";
            try {
              message = JSON.parse(data).message || "";
            } catch {
              message = "";
            }
            if (message) {
              setMessages((m) => {
                const next = m.slice();
                const last = next[next.length - 1];
                next[next.length - 1] = { ...last, notices: [...last.notices, message] };
                return next;
              });
            }
          } else if (event === "error") {
            let message = "The AI assistant is unavailable right now.";
            try {
              message = JSON.parse(data).message || message;
            } catch {
              // keep the default
            }
            throw new Error(message);
          }
        });
      }
      if (!gotContent) {
        setMessages((m) => {
          const next = m.slice();
          const last = next[next.length - 1];
          if (!last.text) next[next.length - 1] = { ...last, text: "The assistant didn't reply. Please try again." };
          return next;
        });
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      setMessages((m) => {
        const next = m.slice();
        const last = next[next.length - 1];
        next[next.length - 1] = {
          ...last,
          text: last.text || err.message || "The AI assistant is unavailable right now. Please try again.",
        };
        return next;
      });
      setFailed(content);
    } finally {
      setStreaming(false);
      streamRef.current = null;
    }
  }

  function newChat() {
    try {
      localStorage.setItem(SESSION_KEY, crypto.randomUUID());
    } catch {
      // ignore
    }
    streamRef.current?.abort();
    setMessages([]);
    setFailed(null);
    setInput("");
  }

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        className="ai-launcher"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Ask Enflite AI"
      >
        Ask Enflite AI
      </button>
      {open && (
        <section className="ai-panel" aria-label="Enflite AI assistant">
          <div className="ai-head">
            <span className="display">Enflite AI</span>
            <span className="ai-head-actions">
              <button type="button" onClick={newChat}>New chat</button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close">Close</button>
            </span>
          </div>
          <div className="ai-msgs" ref={listRef}>
            {messages.length === 0 && (
              <p className="ai-empty">
                Ask about the systems and procedures in this help library - SyteLine forms, fields,
                anything documented here.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role}`}>
                {m.notices.map((n, j) => (
                  <div key={j} className="ai-notice">{n}</div>
                ))}
                {m.text && <div className="ai-text">{m.text}</div>}
              </div>
            ))}
            {streaming && <div className="ai-typing">Thinking&hellip;</div>}
          </div>
          <form
            className="ai-input"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question"
              aria-label="Ask Enflite AI"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            <button type="submit" disabled={streaming || !input.trim()}>
              Send
            </button>
          </form>
          {failed && !streaming && (
            <div className="ai-retry">
              <span>That message didn't go through.</span>
              <button type="button" onClick={() => send(failed, { retryOf: true })}>Retry</button>
            </div>
          )}
          <p className="ai-note">Company internal. Customer, finance and proprietary data stay on the local model.</p>
        </section>
      )}
    </>
  );
}
