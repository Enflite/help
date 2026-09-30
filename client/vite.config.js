import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Static hosting (Vercel) serves files, not the app's routes: after the build, write the app's
// index.html at every page's path (spaces, topics, /search) and as 404.html, so a link straight to
// /syteline/ecmrs/fields/item opens the app instead of Vercel's 404. Also copy the documents
// (content/files/) to /files/..., since the server function has no content/ folder on Vercel.
// Locally and in Docker, Express serves both.
const contentDir = new URL("../content/", import.meta.url);
const staticPages = {
  name: "static-pages",
  apply: "build",
  async closeBundle() {
    const dist = new URL("./dist/", import.meta.url);
    const html = fs.readFileSync(new URL("index.html", dist));
    fs.writeFileSync(new URL("404.html", dist), html);
    if (!fs.existsSync(contentDir)) return; // the Docker build stage has no content/
    fs.cpSync(new URL("files/", contentDir), new URL("files/", dist), { recursive: true });
    const { loadContent } = await import("../server/src/content.js");
    const { spaces, topics } = loadContent(fileURLToPath(contentDir));
    const pages = ["search", ...spaces.map((s) => s.key), ...topics.map((t) => `${t.space}/${t.path}`)];
    for (const page of pages) {
      const dir = new URL(`${page}/`, dist);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(new URL("index.html", dir), html);
    }
  },
};

// In development the API runs on :3000 (npm run dev -w server); Vite proxies to it.
const api = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`;

export default defineConfig({
  plugins: [react(), staticPages],
  server: { proxy: { "/api": api, "/go": api, "/files": api } },
});
