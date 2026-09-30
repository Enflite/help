// API tests against a real MongoDB: MONGODB_URI_TEST (default: the local server, database
// enflite-help-test, dropped afterwards). Skipped when no MongoDB answers.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { config } from "../src/config.js";
import { loadContent } from "../src/content.js";
import { seed } from "../src/seed.js";

const uri = process.env.MONGODB_URI_TEST || "mongodb://127.0.0.1:27017/enflite-help-test";
let server;
let base;
let skip = false;

before(async () => {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
  } catch {
    skip = "no MongoDB at " + uri;
    return;
  }
  await mongoose.connection.dropDatabase();
  const { spaces, topics } = loadContent(config.contentDir);
  await seed(spaces, topics);
  server = createApp({ contentDir: config.contentDir }).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server?.close();
  if (!skip) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

const get = (p) => fetch(base + p, { redirect: "manual" });
const t = (name, fn) => test(name, (ctx) => (skip ? ctx.skip(skip) : fn()));

t("health reports the database", async () => {
  assert.deepEqual(await (await get("/api/health")).json(), { ok: true, db: true });
});

t("spaces and navigation", async () => {
  const spaces = await (await get("/api/spaces")).json();
  assert.ok(spaces.some((s) => s.key === "syteline"));
  const space = await (await get("/api/spaces/syteline")).json();
  assert.ok(space.nav.some((n) => n.path === "ecmrs" && !n.parent));
  assert.equal((await get("/api/spaces/nope")).status, 404);
});

t("a topic comes with its children and linked titles", async () => {
  const form = await (await get("/api/spaces/syteline/topics/ecmrs")).json();
  assert.ok(form.children.some((c) => c.path === "ecmrs/fields/item"));
  const item = await (await get("/api/spaces/syteline/topics/ecmrs/fields/item")).json();
  assert.equal(item.title, "Item");
  assert.equal(item.refs.ecmrs.title, "eCMRs");
  assert.equal((await get("/api/spaces/syteline/topics/ecmrs/fields/nope")).status, 404);
});

t("right-click help redirects a component to its page", async () => {
  const where = async (p) => (await get(p)).headers.get("location");
  assert.equal(await where("/go/syteline/ecmrs/c_item"), "/syteline/ecmrs/fields/item");
  assert.equal(await where("/go/syteline/ecmrs/l_item"), "/syteline/ecmrs/fields/item");
  assert.equal(await where("/go/syteline/ecmrs/c_item.html"), "/syteline/ecmrs/fields/item");
  // No page for the component: the form's page, told what SyteLine sent (the page shows a note).
  assert.equal(await where("/go/syteline/ecmrs/hdr_QUALITY?via=parm"), "/syteline/ecmrs?from=hdr_QUALITY&via=parm");
  assert.equal(await where("/go/syteline/ecmrs?via=none"), "/syteline/ecmrs?from=&via=none");
  assert.equal(await where("/go/syteline/ecmrs"), "/syteline/ecmrs?from=&via=none");
  assert.equal(await where("/go/syteline/nope/c_item"), "/syteline");
});

t("right-click help also takes a query, any letter case, and answers the client as JSON", async () => {
  const where = async (p) => (await get(p)).headers.get("location");
  assert.equal(await where("/go?space=syteline&form=ecmrs&component=c_item&via=parm"), "/syteline/ecmrs/fields/item");
  assert.equal(await where("/go/syteline/ecmrs?component=l_item"), "/syteline/ecmrs/fields/item");
  assert.equal(await where("/go/syteline/ecmrs/C_ITEM"), "/syteline/ecmrs/fields/item");
  assert.equal(await where("/go/syteline/service-orders/UfEvalDateEdit"), "/syteline/service-orders/fields/eval_date");
  assert.equal(await where("/go/syteline/incidents/UfDateOfManufactureGridCol"), "/syteline/incidents/fields/date_of_manufacture");
  assert.equal(await where("/go"), "/");
  const json = await (await get("/api/go/syteline/ecmrs/c_item?via=focus")).json();
  assert.deepEqual(json, { path: "/syteline/ecmrs/fields/item" });
  assert.equal((await get("/api/nope")).status, 404);
});

t("search finds by word and by part of a title", async () => {
  const hits = await (await get("/api/search?q=notify&space=syteline")).json();
  assert.equal(hits[0].path, "ecmrs/fields/notify");
  const partial = await (await get("/api/search?q=assy")).json();
  assert.ok(partial.some((h) => h.path === "ecmrs/fields/next_assy_item"));
  assert.deepEqual(await (await get("/api/search?q=")).json(), []);
});

t("procedure PDFs are served; unknown files are 404", async () => {
  const pdf = await get("/files/syteline/QA-300-037_Rev_A.pdf");
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.equal((await get("/files/syteline/nope.pdf")).status, 404);
  assert.equal((await get("/api/nope")).status, 404);
});
