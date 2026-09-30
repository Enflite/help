// On Vercel the client is its own service: page addresses reach the API, which answers them with
// the client's index.html fetched from CLIENT_URL (vercel.json binding). No database needed.
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";
import { createApp } from "../src/app.js";

let client;
let server;
let base;
let fetched = 0;

before(async () => {
  client = http.createServer((req, res) => {
    fetched += 1;
    if (req.url === "/index.html") res.writeHead(200, { "content-type": "text/html" }).end("<html>app</html>");
    else res.writeHead(404).end();
  }).listen(0);
  const clientUrl = `http://127.0.0.1:${client.address().port}`;
  server = createApp({ clientUrl }).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
  client?.close();
});

test("page addresses get the client's index.html, fetched once", async () => {
  for (const p of ["/", "/syteline/ecmrs/fields/item", "/syteline/service-orders/fields/eval_date", "/search"]) {
    const res = await fetch(base + p);
    assert.equal(res.status, 200, p);
    assert.match(res.headers.get("content-type"), /text\/html/);
    assert.equal(await res.text(), "<html>app</html>");
  }
  assert.equal(fetched, 1);
});

test("unknown API paths stay JSON 404s", async () => {
  const res = await fetch(base + "/api/nope");
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: "Not found" });
});
