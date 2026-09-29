import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the API runs on :3000 (npm run dev -w server); Vite proxies to it.
const api = process.env.API_URL || `http://localhost:${process.env.PORT || 3000}`;

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": api, "/go": api, "/files": api } },
});
