import { expect, test } from "./fixtures";

// Regression coverage for GridBackground.tsx, which previously shipped
// (and shipped again after a first fix attempt) with a resting-state
// opacity too low to be perceptible on real displays -- see GH #23. That
// slipped through twice specifically because this component had *zero*
// test coverage of any kind, only manual/visual inspection. These assert
// the properties that were actually in question: the canvas exists, it
// draws real (non-transparent) pixels, and the rest-state alpha clears a
// floor comfortably above the old broken constant (0.055, maxAlpha ~14)
// so a regression back toward that range fails loudly instead of shipping
// silently again.

interface CanvasSample {
  found: boolean;
  nonZeroAlphaPixels: number;
  totalPixels: number;
  maxAlpha: number;
}

function sampleGridCanvas(page: import("@playwright/test").Page): Promise<CanvasSample> {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas.bg-grid-canvas") as HTMLCanvasElement | null;
    if (!canvas) return { found: false, nonZeroAlphaPixels: 0, totalPixels: 0, maxAlpha: 0 };
    const ctx = canvas.getContext("2d")!;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let nonZeroAlphaPixels = 0;
    let maxAlpha = 0;
    for (let i = 3; i < data.length; i += 4) {
      const a = data[i];
      if (a > 0) {
        nonZeroAlphaPixels++;
        if (a > maxAlpha) maxAlpha = a;
      }
    }
    return { found: true, nonZeroAlphaPixels, totalPixels: data.length / 4, maxAlpha };
  });
}

test.describe("background grid canvas", () => {
  test("is present, correctly positioned, and hidden from the accessibility tree", async ({ page }) => {
    await page.goto("/");
    const canvas = page.locator("canvas.bg-grid-canvas");
    await expect(canvas).toBeAttached();
    await expect(canvas).toHaveAttribute("aria-hidden", "true");

    const style = await canvas.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { position: cs.position, zIndex: cs.zIndex, display: cs.display };
    });
    expect(style).toMatchObject({ position: "fixed", zIndex: "-2", display: "block" });
  });

  test("draws real, visible pixels at rest -- not just a blank/transparent canvas", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(200); // let the first animation frame land

    const sample = await sampleGridCanvas(page);
    expect(sample.found).toBe(true);
    expect(sample.nonZeroAlphaPixels).toBeGreaterThan(0);
  });

  test("rest-state opacity clears a floor well above the previously-shipped invisible values (GH #23, SS-002)", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(200);

    const sample = await sampleGridCanvas(page);
    // Three constants have shipped here: 0.055 (design mockup, peak ~14-19/255),
    // 0.12 (GH #23's fix attempt, peak ~30-42/255 -- still confirmed
    // imperceptible on real 2K/4K/Mac M4 hardware, see SS-002), and the
    // current 0.26 (peak ~75-90/255). 55 sits above every prior attempt's
    // ceiling, so a regression to either older value fails this assertion
    // instead of requiring another round of manual/visual investigation.
    expect(sample.maxAlpha).toBeGreaterThan(55);
  });

  test("is present (and still drawing) on the How It Works and reveal-error pages too", async ({ page, createSecret }) => {
    await page.goto("/how");
    await page.waitForTimeout(200);
    expect((await sampleGridCanvas(page)).nonZeroAlphaPixels).toBeGreaterThan(0);

    const { id } = await createSecret();
    await page.goto(`/s/${id}`); // missing-key / "incomplete link" state
    await page.waitForTimeout(200);
    expect((await sampleGridCanvas(page)).nonZeroAlphaPixels).toBeGreaterThan(0);
  });

  test("respects prefers-reduced-motion: draws a static frame with no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForTimeout(200);

    const first = await sampleGridCanvas(page);
    expect(first.found).toBe(true);
    expect(first.nonZeroAlphaPixels).toBeGreaterThan(0);

    // Under reduced motion the component skips the rAF loop entirely (see
    // GridBackground.tsx) -- the frame it drew on mount shouldn't change on
    // its own afterwards.
    await page.waitForTimeout(500);
    const second = await sampleGridCanvas(page);
    expect(second.nonZeroAlphaPixels).toBe(first.nonZeroAlphaPixels);
    expect(second.maxAlpha).toBe(first.maxAlpha);

    expect(errors).toEqual([]);
  });

  test("?grid-debug=1 renders the grid in loud magenta and logs on mount -- absent by default", async ({ page }) => {
    const logs: string[] = [];
    page.on("console", (msg) => logs.push(msg.text()));

    await page.goto("/");
    await page.waitForTimeout(200);
    expect(logs.some((l) => l.includes("grid-debug"))).toBe(false);

    await page.goto("/?grid-debug=1");
    await page.waitForTimeout(200);

    expect(logs.some((l) => l.includes("grid-debug: on"))).toBe(true);

    const sample = await page.evaluate(() => {
      const canvas = document.querySelector("canvas.bg-grid-canvas") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let magentaPixels = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 200 && data[i + 1] < 50 && data[i + 2] > 200 && data[i + 3] > 150) magentaPixels++;
      }
      return magentaPixels;
    });
    expect(sample).toBeGreaterThan(0);
  });

  test("?grid-debug=1 marker tracks the pointer and logs the first event once", async ({ page }) => {
    const logs: string[] = [];
    page.on("console", (msg) => logs.push(msg.text()));

    await page.goto("/?grid-debug=1");
    await page.waitForTimeout(200);
    await page.mouse.move(300, 300);
    await page.mouse.move(320, 310); // a second move shouldn't produce a second log
    await page.waitForTimeout(200);

    const firstPointerLogs = logs.filter((l) => l.includes("grid-debug: first pointer event"));
    expect(firstPointerLogs.length).toBe(1);

    const nearMarker = await page.evaluate(() => {
      const canvas = document.querySelector("canvas.bg-grid-canvas") as HTMLCanvasElement;
      const ctx = canvas.getContext("2d")!;
      const data = ctx.getImageData(280, 280, 60, 60).data;
      let magentaPixels = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 200 && data[i + 1] < 50 && data[i + 2] > 200 && data[i + 3] > 150) magentaPixels++;
      }
      return magentaPixels;
    });
    expect(nearMarker).toBeGreaterThan(0);
  });
});
