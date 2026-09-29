// npm run dev: starts the API (:3000) and the Vite client (:5173) together, on Windows too.
// (A plain "a & b" in package.json runs them one after the other under Windows cmd, so the
// client never starts.) Ctrl+C stops both.
import { spawn } from "node:child_process";

const children = ["server", "client"].map((ws) =>
  spawn("npm", ["run", "dev", "-w", ws], { stdio: "inherit", shell: process.platform === "win32" }),
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
