import fs from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Documents (content/files/) go into the build as /files/..., so the client serves them on Vercel,
// where the server function has no content/ folder. Locally and in Docker, Express serves them.
const contentFiles = new URL("../content/files/", import.meta.url);
const copyContentFiles = {
  name: "copy-content-files",
  apply: "build",
  closeBundle() {
    if (!fs.existsSync(contentFiles)) return; // the Docker build stage has no content/
    fs.cpSync(contentFiles, new URL("./dist/files/", import.meta.url), { recursive: true });
  },
};

// In development the API runs on :3000 (npm run dev -w server); Vite proxies to it.
const api = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`;

export default defineConfig({
  plugins: [react(), copyContentFiles],
  server: { proxy: { "/api": api, "/go": api, "/files": api } },
});
