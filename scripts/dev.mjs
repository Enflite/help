// npm run dev: starts the API (:3000) and the Vite client (:5173) together, on Windows too.
// (A plain "a & b" in package.json runs them one after the other under Windows cmd, so the
// client never starts.) Ctrl+C stops both.
import { spawn } from "node:child_process";
import fs from "node:fs";

// Load .env here too, so the Vite client (its /api proxy) sees the same PORT / API_URL as the API.
const envFile = new URL("../.env", import.meta.url);
if (fs.existsSync(envFile) && typeof process.loadEnvFile === "function") process.loadEnvFile(envFile);

// Windows needs a shell to find npm.cmd; pass it one command string (args with shell: true is
// deprecated, DEP0190).
const children = ["server", "client"].map((ws) =>
  process.platform === "win32"
    ? spawn(`npm run dev -w ${ws}`, { stdio: "inherit", shell: true })
    : spawn("npm", ["run", "dev", "-w", ws], { stdio: "inherit" }),
);

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exit(code);
}

for (const child of children) child.on("exit", (code) => stop(code ?? 0));
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
