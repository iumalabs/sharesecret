import { defineConfig, devices } from "@playwright/test";

const PORT = 5183;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Capped rather than left at Playwright's default (half the machine's
  // cores): each worker drives a full Chromium instance rendering a
  // backdrop-filter-heavy UI, and this repo is routinely run alongside other
  // dev tooling (wrangler dev/tail, other projects' workers, editors). High
  // worker counts were observed to starve individual pages under real-world
  // contention, producing spurious client-side timeouts unrelated to the
  // app itself.
  workers: process.env.CI ? 2 : 4,
  timeout: 45_000,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    permissions: ["clipboard-read", "clipboard-write"],
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /.*\.mobile\.spec\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /.*\.mobile\.spec\.ts/,
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/api/v1/ping`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
