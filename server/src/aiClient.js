// Client for the backend-ai API (Enflite AI). The help server holds one service account and
// logs in once; the browser never sees the credentials. JWTs live ~15 minutes: the token is
// refreshed proactively when under two minutes remain, and a single retry with a fresh login
// happens when the upstream answers 401.
const REFRESH_WITHIN_MS = 120_000;
const DEFAULT_TTL_MS = 15 * 60 * 1000;
const LOGIN_TIMEOUT_MS = 15_000;
const CHAT_TIMEOUT_MS = 180_000;

function decodeExpiryMs(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    if (typeof payload.exp === "number") return payload.exp * 1000;
  } catch {
    // fall through to the default TTL
  }
  return Date.now() + DEFAULT_TTL_MS;
}

export class AiClient {
  constructor({ apiUrl, email, password } = {}) {
    this.apiUrl = (apiUrl || "").replace(/\/$/, "");
    this.email = email || "";
    this.password = password || "";
    this.token = null;
    this.expiresAt = 0;
  }

  isConfigured() {
    return Boolean(this.apiUrl && this.email && this.password);
  }

  async login() {
    let res;
    try {
      res = await fetch(`${this.apiUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: this.email, password: this.password }),
        signal: AbortSignal.timeout(LOGIN_TIMEOUT_MS),
      });
    } catch (err) {
      throw new Error(`AI login failed: ${err.message}`);
    }
    if (!res.ok) throw new Error(`AI login failed (upstream ${res.status})`);
    const body = await res.json().catch(() => ({}));
    if (!body.accessToken) throw new Error("AI login failed (no access token)");
    this.token = body.accessToken;
    this.expiresAt = decodeExpiryMs(this.token);
    return this.token;
  }

  async getToken(force = false) {
    if (!force && this.token && this.expiresAt - Date.now() > REFRESH_WITHIN_MS) return this.token;
    return this.login();
  }

  // POST to the upstream API with auth. On 401 the token is refreshed once and the request
  // retried once.
  async request(path, { body, timeoutMs = LOGIN_TIMEOUT_MS } = {}) {
    const send = async (token) => fetch(`${this.apiUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    let res = await send(await this.getToken());
    if (res.status === 401) res = await send(await this.getToken(true));
    return res;
  }

  async chat(upstreamBody) {
    return this.request("/api/v1/chat", { body: upstreamBody, timeoutMs: CHAT_TIMEOUT_MS });
  }
}
