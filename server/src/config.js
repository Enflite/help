import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Read <repo>/.env if there is one (Node 20.12+). Variables already set in the environment win.
const envFile = path.join(root, ".env");
if (fs.existsSync(envFile) && typeof process.loadEnvFile === "function") process.loadEnvFile(envFile);

export const config = {
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/enflite-help",
  contentDir: process.env.CONTENT_DIR || path.join(root, "content"),
  clientDist: process.env.CLIENT_DIST || path.join(root, "client", "dist"),
  ai: {
    apiUrl: (process.env.AI_API_URL || "").replace(/\/$/, ""),
    email: process.env.AI_SERVICE_EMAIL || "",
    password: process.env.AI_SERVICE_PASSWORD || "",
  },
};
