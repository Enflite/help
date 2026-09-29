import fs from "node:fs";
import path from "node:path";
import express from "express";
import mongoose from "mongoose";
import { Space } from "./models/Space.js";
import { Topic } from "./models/Topic.js";

const NAV_FIELDS = "path title type icon parent group groups order number summary";
const LIST_FIELDS = "path title type icon summary group order number eyebrow";

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function createApp({ contentDir, clientDist } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);

  const api = express.Router();

  api.get("/health", (req, res) => {
    res.json({ ok: true, db: mongoose.connection.readyState === 1 });
  });

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

  api.use((req, res) => res.status(404).json({ error: "Not found" }));
  app.use("/api", api);

  // Right-click -> Help from a form: /go/<space>/<form>/<component> opens the page for that
  // component (its topic's aliases), else the form's page. ".html" is accepted and ignored.
  app.get(["/go/:space/:form", "/go/:space/:form/:component"], wrap(async (req, res) => {
    const { space, form } = req.params;
    const component = (req.params.component || "").replace(/\.html$/i, "");
    let target = null;
    if (component) {
      target = await Topic.findOne(
        { space, aliases: component, $or: [{ path: form }, { path: new RegExp(`^${escapeRegex(form)}/`) }] },
        "path",
      ).lean();
    }
    if (!target) target = await Topic.findOne({ space, path: form }, "path").lean();
    const to = target ? `/${space}/${target.path}` : `/${space}`;
    // One line per right-click -> Help: which component SyteLine sent, how its script found it
    // (?via=parm|focus|none) and where it went. Shows whether field-level help is working.
    console.log(`help link ${space}/${form} component=${component || "-"} via=${req.query.via || "-"} -> ${to}`);
    res.redirect(302, to);
  }));

  if (contentDir) {
    app.use("/files", express.static(path.join(contentDir, "files"), { fallthrough: false, index: false }));
  }

  if (clientDist && fs.existsSync(path.join(clientDist, "index.html"))) {
    app.use(express.static(clientDist, { index: false }));
    app.get("/*splat", (req, res) => res.sendFile(path.join(clientDist, "index.html")));
  }

  app.use((err, req, res, next) => {
    if (err.status === 404 || err.statusCode === 404) return res.status(404).send("Not found");
    console.error(err);
    res.status(500).json({ error: "Server error" });
  });

  return app;
}
