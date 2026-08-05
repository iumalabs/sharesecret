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
  // Vite normally infers this as <nearest package.json>/node_modules/.vite,
  // which @vitejs/plugin-react's default exclude (/node_modules/) skips for
  // Babel/Fast Refresh transforms. This repo has no package.json, so Vite
  // fell back to putting the cache at <root>/.vite instead -- outside
  // node_modules -- which made plugin-react run Babel over pre-bundled
  // vendor chunks (e.g. react-dom_client.js) and log a "code generator
  // deoptimised" warning once a chunk passed Babel's 500KB compact-printing
  // threshold. Pointing cacheDir back under node_modules restores the
  // intended exclusion.
  cacheDir: path.resolve(repoRoot, "node_modules/.vite"),
  plugins: [react(), cloudflare()],
});
