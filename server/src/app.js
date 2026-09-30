import fs from "node:fs";
import path from "node:path";
import express from "express";
import mongoose from "mongoose";
import { Space } from "./models/Space.js";
import { Topic } from "./models/Topic.js";
import { AiClient } from "./aiClient.js";
import { createAiRouter } from "./aiRoutes.js";
import { config } from "./config.js";

const NAV_FIELDS = "path title type icon parent group groups order number summary";
const LIST_FIELDS = "path title type icon summary group order number eyebrow";

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function createApp({ contentDir, clientDist, clientUrl, aiConfig } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);

  const api = express.Router();

  api.get("/health", (req, res) => {
    res.json({ ok: true, db: mongoose.connection.readyState === 1 });
  });

  api.use("/ai", createAiRouter({ ai: new AiClient(aiConfig ?? config.ai) }));

  api.get("/spaces", wrap(async (req, res) => {
    res.json(await Space.find({}, "-_id key name description home order").sort({ order: 1, name: 1 }).lean());
  }));

  // A space and its navigation tree (flat; the client nests it by parent/group).
  api.get("/spaces/:space", wrap(async (req, res) => {
    const space = await Space.findOne({ key: req.params.space }, "-_id key name description home order").lean();
    if (!space) return res.status(404).json({ error: "Space not found" });
    const nav = await Topic.find({ space: space.key }, `-_id ${NAV_FIELDS}`).sort({ order: 1, title: 1 }).lean();
    res.json({ ...space, nav });
  }));

  // One topic, with its children and the titles of the pages it links to.
  api.get("/spaces/:space/topics/*path", wrap(async (req, res) => {
    const { space } = req.params;
    const topicPath = [].concat(req.params.path).join("/");
    const topic = await Topic.findOne({ space, path: topicPath }, "-_id -__v -searchText").lean();
    if (!topic) return res.status(404).json({ error: "Topic not found" });
    const linked = new Set([...topic.related, ...(topic.parent ? [topic.parent] : [])]);
    for (const b of topic.blocks) if (b.t === "links") (b.items || []).forEach((p) => linked.add(p));
    const [children, refs] = await Promise.all([
      Topic.find({ space, parent: topicPath }, `-_id ${LIST_FIELDS}`).sort({ order: 1, title: 1 }).lean(),
      Topic.find({ space, path: { $in: [...linked] } }, `-_id ${LIST_FIELDS}`).lean(),
    ]);
    res.json({ ...topic, children, refs: Object.fromEntries(refs.map((r) => [r.path, r])) });
  }));

  api.get("/search", wrap(async (req, res) => {
    const q = String(req.query.q || "").trim().slice(0, 200);
    if (!q) return res.json([]);
    const filter = { $text: { $search: q } };
    if (req.query.space) filter.space = String(req.query.space);
    let hits = await Topic.find(filter, { score: { $meta: "textScore" }, space: 1, path: 1, title: 1, summary: 1, eyebrow: 1, type: 1, number: 1, _id: 0 })
      .sort({ score: { $meta: "textScore" } }).limit(25).lean();
    if (!hits.length) { // word stems miss partial words ("assy", "CMR-26"): fall back to a title match
      const re = new RegExp(escapeRegex(q), "i");
      const f2 = { $or: [{ title: re }, { number: re }, { summary: re }] };
      if (filter.space) f2.space = filter.space;
      hits = await Topic.find(f2, "-_id space path title summary eyebrow type number").limit(25).lean();
    }
    res.json(hits);
  }));

  // Right-click -> Help from a form. SyteLine sends the space, the form and the right-clicked
  // component, as a path (/go/syteline/ecmrs/c_item) or as a query
  // (/go?space=syteline&form=ecmrs&component=c_item); the two can be mixed. /go redirects to the
  // page whose aliases hold the component, else the form's page. /api/go answers the same with
  // { path } for the client, which handles /go links that reach it instead of the API.
  const helpTarget = async (req) => {
    const q = req.query;
    const one = (v) => String([].concat(v ?? "")[0]).trim();
    const space = one(req.params.space || q.space);
    const form = one(req.params.form || q.form);
    const component = one(req.params.component || q.component || q.field).replace(/\.html$/i, "");
    let target = null;
    if (space && form && component) {
      target = await Topic.findOne({
        space,
        aliases: new RegExp(`^${escapeRegex(component)}$`, "i"),
        $or: [{ path: form }, { path: new RegExp(`^${escapeRegex(form)}/`) }],
      }, "path").lean();
    }
    let to = target ? `/${space}/${target.path}` : null;
    if (!to && space && form) {
      const formPage = await Topic.findOne({ space, path: form }, "path infor").lean();
      if (formPage?.infor?.url) {
        // An Infor form we customize (Service Orders, Incidents): a component with no Enflite page
        // is one of Infor's, so open Infor's own help: its field topic if it has one, else the form's.
        const byName = formPage.infor.components || {};
        const key = Object.keys(byName).find((k) => k.toLowerCase() === component.toLowerCase());
        to = key ? byName[key] : formPage.infor.url;
      } else if (formPage) {
        // Our own form (eCMRs): the form's page, told what SyteLine sent (it shows a note), so
        // "why didn't it open the field?" can be answered from the screen.
        const from = new URLSearchParams({ from: component, via: one(q.via) || "none" });
        to = `/${space}/${formPage.path}?${from}`;
      }
    }
    if (!to) to = space ? `/${space}` : "/";
    // One line per right-click -> Help: which component SyteLine sent, how its script found it
    // (?via=parm|focus|none) and where it went. Shows whether field-level help is working.
    // ev= is the SyteLine event that sent it (component = right-click a field, form = the form's Help).
    console.log(`help link ${space || "-"}/${form || "-"} component=${component || "-"} via=${one(q.via) || "-"} ev=${one(q.ev) || "-"} -> ${to}`);
    return to;
  };
  const goPaths = ["/go", "/go/:space", "/go/:space/:form", "/go/:space/:form/:component"];
  api.get(goPaths, wrap(async (req, res) => res.json({ path: await helpTarget(req) })));
  api.use((req, res) => res.status(404).json({ error: "Not found" }));
  app.use("/api", api);
  app.get(goPaths, wrap(async (req, res) => res.redirect(302, await helpTarget(req))));

  if (contentDir) {
    app.use("/files", express.static(path.join(contentDir, "files"), { fallthrough: false, index: false }));
  }

  if (clientDist && fs.existsSync(path.join(clientDist, "index.html"))) {
    app.use(express.static(clientDist, { index: false, redirect: false })); // page folders: SPA below
    app.get(["/", "/*splat"], (req, res) => res.sendFile(path.join(clientDist, "index.html")));
  } else if (clientUrl) {
    // On Vercel the client is its own service and page addresses (/syteline/ecmrs/fields/item)
    // come here (vercel.json): answer them with the client's index.html, fetched from the client
    // service's internal address and kept for a minute.
    let shell = { html: "", at: 0 };
    app.get(["/", "/*splat"], wrap(async (req, res) => {
      if (!shell.html || Date.now() - shell.at > 60_000) {
        const r = await fetch(new URL("index.html", clientUrl.replace(/\/?$/, "/")));
        if (!r.ok) throw new Error(`client index.html: ${r.status}`);
        shell = { html: await r.text(), at: Date.now() };
      }
      res.type("html").set("Cache-Control", "no-cache").send(shell.html);
    }));
  }

  app.use((err, req, res, next) => {
    if (err.status === 404 || err.statusCode === 404) return res.status(404).send("Not found");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  });

  return app;
}
