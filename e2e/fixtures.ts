import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page, test as base } from "@playwright/test";
import { PIN_SIZE } from "../src/shared/constants";

export { expect };

export interface CreatedSecret {
  link: string;
  id: string;
  key: string;
  pin: string;
  message: string;
}

/** Grabs the id/key pair out of a `/s/<id>#<key>` link, however it's phrased. */
export function parseLink(link: string): { id: string; key: string } {
  const url = new URL(link);
  const id = url.pathname.split("/").pop() ?? "";
  const key = url.hash.slice(1);
  return { id, key };
}

async function readResultPanels(page: Page): Promise<{ link: string; pin: string }> {
  const panels = page.locator(".result-value");
  const link = (await panels.nth(0).textContent())?.trim() ?? "";
  const pin = (await panels.nth(1).textContent())?.trim() ?? "";
  return { link, pin };
}

/**
 * `RevealPage` scrubs the key out of the address bar via `history.replaceState`
 * once it's read the fragment, so the *current* URL is just `/s/:id` (no hash)
 * after the first visit. `page.goto(sameLink)` again from there differs from
 * the current URL only by its hash, which browsers treat as a same-document,
 * fragment-only navigation -- it does NOT reload the page or remount React,
 * so RevealPage's mount effect never re-runs and the UI keeps showing
 * whatever state it was already in. Bouncing through an unrelated URL first
 * forces a real cross-document navigation so the reveal flow actually re-runs
 * from scratch, matching what a recipient re-opening the link in a fresh tab
 * would see.
 */
export async function gotoFresh(page: Page, url: string): Promise<void> {
  await page.goto("about:blank");
  await page.goto(url);
}

/**
 * Waits for the custom @font-face fonts (Space Grotesk / JetBrains Mono) to
 * finish loading. Without this, an axe-core contrast scan racing the
 * fallback-to-webfont swap can measure a transient fallback-font rendering
 * and report a false-positive `color-contrast` violation that isn't
 * reproducible once the page has actually settled.
 */
export async function waitForFonts(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
}

/**
 * The Worker's rate limiters key on `CF-Connecting-IP`, which is unset (and
 * so collapses to a single "unknown" bucket) for every local request. Left
 * alone, the whole e2e suite would share one 20-req/60s create bucket and
 * one 10-req/60s reveal bucket (see src/worker/middleware/rate-limit.ts) and
 * would flake with spurious 429s well before covering everything. Giving
 * each test a distinct synthetic IP gives it its own bucket instead --
 * dedicated rate-limit behavior itself is exercised in rate-limit.spec.ts.
 */
function syntheticIp(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return `10.${(hash >>> 24) & 255}.${(hash >>> 16) & 255}.${(hash >>> 8) & 255}`;
}

type Fixtures = {
  /** Fills out the compose form and submits it, returning the sealed link/PIN and a fresh reveal-page fixture. */
  createSecret: (message?: string) => Promise<CreatedSecret>;
};

// Populated by vite-plugin-istanbul (see src/react-app/vite.config.ts) only
// when COVERAGE=true; `window.__coverage__` doesn't exist otherwise, so this
// stays a no-op for every normal test:e2e run. Resolved against process.cwd()
// rather than this file's own location (e.g. via import.meta) -- Playwright
// compiles spec/fixture files to CJS here, where `import.meta` isn't valid
// syntax; `deno task test:e2e:coverage` always invokes from the repo root,
// same as nyc's own --temp-dir=.nyc_output in that task, so the two agree.
const NYC_OUTPUT_DIR = path.resolve(process.cwd(), ".nyc_output");

async function saveCoverage(page: Page, testId: string): Promise<void> {
  const coverage = await page.evaluate(() => (globalThis as { __coverage__?: unknown }).__coverage__).catch(() =>
    undefined
  );
  if (!coverage) return;
  await mkdir(NYC_OUTPUT_DIR, { recursive: true });
  await writeFile(path.join(NYC_OUTPUT_DIR, `${testId}.json`), JSON.stringify(coverage));
}

export const test = base.extend<Fixtures>({
  page: async ({ page }, use, testInfo) => {
    await page.context().setExtraHTTPHeaders({ "CF-Connecting-IP": syntheticIp(testInfo.testId) });
    // deno-lint-ignore react-rules-of-hooks -- Playwright's fixture `use`, not React's
    await use(page);
    // Grab whatever coverage this test's page(s) accumulated before the
    // fixture tears the page down -- covers page.goto() navigations within
    // the test, but not a page closed early by the test itself.
    if (!page.isClosed()) await saveCoverage(page, testInfo.testId);
  },

  createSecret: async ({ page }, use) => {
    // deno-lint-ignore react-rules-of-hooks -- Playwright's fixture `use`, not React's
    await use(async (message = `e2e secret ${Date.now()}-${Math.random().toString(36).slice(2)}`) => {
      await page.goto("/");
      await page.getByPlaceholder("Type the thing you shouldn't send over chat…").fill(message);
      await page.getByRole("button", { name: "Encrypt & get link" }).click();
      await expect(page.getByText("Your secret is now a stranger to us.")).toBeVisible();

      const { link, pin } = await readResultPanels(page);
      expect(pin).toMatch(new RegExp(`^\\d{${PIN_SIZE}}$`));
      const { id, key } = parseLink(link);
      expect(id.length).toBeGreaterThan(0);
      expect(key.length).toBeGreaterThan(0);

      return { link, id, key, pin, message };
    });
  },
});
