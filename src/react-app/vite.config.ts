import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import istanbulPkg from "vite-plugin-istanbul";

// vite-plugin-istanbul's package.json omits "type": "module", which confuses
// Deno's ESM/CJS interop detection for its default export (`deno check`
// resolves the import as the whole module namespace instead of the function
// it actually is at runtime, even though the .mjs/.d.ts themselves are a
// plain `export { istanbulPlugin as default }`). The re-cast through
// `unknown` is a types-only workaround for that packaging quirk.
const istanbul = istanbulPkg as unknown as (opts?: Record<string, unknown>) => PluginOption;

// This config file lives in src/react-app/, but Vite's project root stays
// the repo root (where index.html and wrangler.jsonc live) -- root and
// config-file location are independent Vite concepts.
const repoRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");

// Only instrument for coverage when explicitly asked (COVERAGE=true, set by
// `deno task test:e2e:coverage`) -- Babel's istanbul instrumentation adds
// per-statement counters to every module, which is unwanted overhead for
// normal dev/build/test:e2e runs and would also skew grid-background.spec.ts's
// timing-sensitive assertions.
const coverage = process.env.COVERAGE === "true";

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
  plugins: [
    react(),
    cloudflare(),
    coverage &&
    istanbul({
      include: "src/react-app/**/*.{ts,tsx}",
      exclude: ["node_modules", "e2e"],
      extension: [".ts", ".tsx"],
      requireEnv: false,
    }),
  ],
});
