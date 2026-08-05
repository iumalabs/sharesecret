import path from "node:path";
import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";

const migrations = await readD1Migrations(path.join(__dirname, "migrations"));

export default defineConfig({
  test: {
    // Without this, Vitest's default glob also matches e2e/*.spec.ts and
    // tries to run the Playwright suite inside the Workers pool -- which
    // has no real DOM/Node module resolution for playwright-core's own
    // dependencies and fails outright. e2e/ is exercised by `deno task
    // test:e2e` (Playwright itself), not by Vitest.
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/apply-migrations.ts"],
  },
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: migrations,
          PIN_HASH_PEPPER: "test-only-pepper-not-a-real-secret",
        },
      },
    }),
  ],
});
