import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const config = {
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/enflite-help",
  contentDir: process.env.CONTENT_DIR || path.join(root, "content"),
  clientDist: process.env.CLIENT_DIST || path.join(root, "client", "dist"),
};
