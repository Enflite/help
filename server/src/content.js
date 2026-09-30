// Reads and checks the help content in content/ (the source of truth, kept in git). The seed
// script loads it into MongoDB; `npm run check` runs the same checks without a database.
import fs from "node:fs";
import path from "node:path";

export const BLOCK_TYPES = new Set([
  "p", "h2", "h3", "list", "steps", "table", "children", "links", "meta", "notice", "legend",
  "pstep", "flowchart",
]);
const TOPIC_KEYS = ["path", "type", "title"];

// Plain text of a block, for search: drops **bold** markers and keeps link labels.
export function plain(text = "") {
  return String(text).replace(/\*\*|`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

export function blockText(b) {
  const parts = [b.text, b.num, b.was, b.why, b.title];
  for (const k of ["items", "head"]) if (Array.isArray(b[k])) parts.push(...b[k].map(String));
  if (Array.isArray(b.rows)) for (const r of b.rows) parts.push(...r.map(String));
  return parts.filter(Boolean).map(plain).join(" ");
}

export function searchText(topic) {
  return (topic.blocks || []).map(blockText).join(" ").replace(/\s+/g, " ").trim();
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(`${file}: ${err.message}`);
  }
}

// Returns { spaces, topics, errors }. Topics carry their `space` and the file they came from.
export function loadContent(dir) {
  const errors = [];
  const spaces = readJson(path.join(dir, "spaces.json"));
  const topics = [];
  for (const space of spaces) {
    const spaceDir = path.join(dir, space.key);
    if (!fs.existsSync(spaceDir)) {
      errors.push(`space ${space.key}: no folder content/${space.key}/`);
      continue;
    }
    for (const name of fs.readdirSync(spaceDir).filter((f) => f.endsWith(".json")).sort()) {
      const file = path.join(spaceDir, name);
      const data = readJson(file);
      if (data.space !== space.key) errors.push(`${file}: "space" must be "${space.key}"`);
      for (const t of data.topics || []) topics.push({ ...t, space: space.key, _file: `${space.key}/${name}` });
    }
  }
  errors.push(...validate(spaces, topics, dir));
  return { spaces, topics, errors };
}

function linkTargets(text = "") {
  return [...String(text).matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);
}

export function validate(spaces, topics, dir) {
  const errors = [];
  const keys = new Set(spaces.map((s) => s.key));
  const byPath = new Map();
  for (const t of topics) {
    const where = `${t._file} ${t.path || "(no path)"}`;
    for (const k of TOPIC_KEYS) if (!t[k]) errors.push(`${where}: missing "${k}"`);
    const id = `${t.space}/${t.path}`;
    if (byPath.has(id)) errors.push(`${where}: duplicate path`);
    byPath.set(id, t);
  }
  const aliasOwner = new Map();
  for (const t of topics) {
    const where = `${t._file} ${t.path}`;
    const has = (p) => byPath.has(`${t.space}/${p}`);
    if (t.parent && !has(t.parent)) errors.push(`${where}: parent "${t.parent}" not found`);
    if (t.parent && t.group) {
      const parent = byPath.get(`${t.space}/${t.parent}`);
      if (parent?.groups?.length && !parent.groups.includes(t.group))
        errors.push(`${where}: group "${t.group}" is not in ${t.parent}'s groups`);
    }
    for (const r of t.related || []) if (!has(r)) errors.push(`${where}: related "${r}" not found`);
    for (const b of t.blocks || []) {
      if (!BLOCK_TYPES.has(b.t)) errors.push(`${where}: unknown block type "${b.t}"`);
      if (b.t === "links") for (const p of b.items || []) if (!has(p)) errors.push(`${where}: link "${p}" not found`);
      for (const target of linkTargets(JSON.stringify(b))) {
        if (target.startsWith("/files/")) {
          if (!fs.existsSync(path.join(dir, target))) errors.push(`${where}: file ${target} not found`);
        } else if (target.startsWith("/")) {
          const [space, ...rest] = target.slice(1).split("/");
          if (!keys.has(space) || (rest.length && !byPath.has(`${space}/${rest.join("/")}`)))
            errors.push(`${where}: link ${target} not found`);
        }
      }
    }
    if (t.infor) {
      const urls = [t.infor.url, ...Object.values(t.infor.components || {})];
      if (!t.infor.url) errors.push(`${where}: infor needs a "url"`);
      for (const u of urls) if (u && !/^https:\/\//.test(u)) errors.push(`${where}: infor URL must be https: ${u}`);
    }
    // One component opens one page: aliases are unique within the form they belong to.
    const form = (t.path || "").split("/")[0];
    for (const a of t.aliases || []) {
      const k = `${t.space}/${form}/${a}`;
      if (aliasOwner.has(k)) errors.push(`${where}: alias "${a}" also on ${aliasOwner.get(k)}`);
      aliasOwner.set(k, t.path);
    }
  }
  return errors;
}
