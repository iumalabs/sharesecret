import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

// This config file lives in src/react-app/, but Vite's project root stays
// the repo root (where index.html and wrangler.jsonc live) -- root and
// config-file location are independent Vite concepts.
const repoRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");

export default defineConfig({
  root: repoRoot,
  plugins: [react(), cloudflare()],
});
