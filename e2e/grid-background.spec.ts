import { expect, test } from "./fixtures";

// Regression coverage for GridBackground.tsx, which has shipped several
// times with a resting-state opacity too low to be perceptible on real
// displays (GH #23, then again after a first fix attempt -- see SS-002)
// before the root cause turned out to be the Canvas 2D rendering path itself
// (thin, low-alpha strokes render inconsistently across real GPU/driver
// combinations), not just the alpha value. The primary path is now WebGL2,
// ported from the design mockup's grid-webgl.js. When WebGL2 is unavailable
// the fallback is a pure-CSS grid (background-image + mask), not Canvas 2D
// -- the design mockup dropped its Canvas 2D fallback for the same reason it
// dropped Canvas 2D as the primary renderer. These tests sample whichever
// path the component actually took, since Chromium (this suite's browser)
// supports WebGL2 and will exercise the primary path by default.

interface CanvasSample {
  found: boolean;
  nonZeroAlphaPixels: number;
  totalPixels: number;
  maxAlpha: number;
}

// Reads back whichever context GridBackground actually created. A canvas's
// context type is fixed for its lifetime, so probing getContext("webgl2")
// returns the existing context if that's what was created, or null if a 2D
// context (or nothing) was created instead -- safe to probe without
// accidentally creating the wrong kind.
function sampleGridCanvas(page: import("@playwright/test").Page): Promise<CanvasSample> {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas.bg-grid-canvas") as HTMLCanvasElement | null;
    if (!canvas) return { found: false, nonZeroAlphaPixels: 0, totalPixels: 0, maxAlpha: 0 };

    const gl = canvas.getContext("webgl2");
    let data: Uint8Array | Uint8ClampedArray;
    if (gl) {
      const pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      data = pixels;
    } else {
      const ctx = canvas.getContext("2d")!;
      data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    }

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

// Counts magenta (debug-mode) pixels in a CSS-pixel region, handling the
// WebGL/Canvas2D context difference and WebGL's bottom-up readPixels origin.
function countMagentaInRegion(
  page: import("@playwright/test").Page,
  region: { x: number; y: number; w: number; h: number },
): Promise<number> {
  return page.evaluate((r) => {
    const canvas = document.querySelector("canvas.bg-grid-canvas") as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2");
    let data: Uint8Array | Uint8ClampedArray;
    if (gl) {
      const dpr = canvas.width / window.innerWidth;
      const w = Math.round(r.w * dpr);
      const h = Math.round(r.h * dpr);
      const x = Math.round(r.x * dpr);
      // WebGL's readPixels origin is bottom-left; flip the CSS top-down y.
      const y = canvas.height - Math.round((r.y + r.h) * dpr);
      const pixels = new Uint8Array(w * h * 4);
      gl.readPixels(x, Math.max(0, y), w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      data = pixels;
    } else {
      const ctx = canvas.getContext("2d")!;
      data = ctx.getImageData(r.x, r.y, r.w, r.h).data;
    }
    let magentaPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 150 && data[i + 1] < 50 && data[i + 2] > 150 && data[i + 3] > 80) magentaPixels++;
    }
    return magentaPixels;
  }, region);
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
    // z-index: 0, not negative -- see the comment in index.css on why negative
    // z-index was dropped (it failed to composite on some real hardware).
    expect(style).toMatchObject({ position: "fixed", zIndex: "0", display: "block" });
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
    // Alpha here is WebGL's premultiplied output (color = rgb*alpha), same
    // scale as the plain alpha channel Canvas 2D reported previously. Floor
    // sits comfortably above every prior broken constant's ceiling so a
    // regression fails loudly instead of requiring another investigation.
    expect(sample.maxAlpha).toBeGreaterThan(15);
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

    const viewport = page.viewportSize()!;
    const magentaPixels = await countMagentaInRegion(page, { x: 0, y: 0, w: viewport.width, h: viewport.height });
    expect(magentaPixels).toBeGreaterThan(0);
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

    const nearMarker = await countMagentaInRegion(page, { x: 270, y: 270, w: 60, h: 60 });
    expect(nearMarker).toBeGreaterThan(0);
  });

  test("falls back to a pure-CSS grid when WebGL2 is unavailable, with no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.getContext = new Proxy(HTMLCanvasElement.prototype.getContext, {
        apply(target, thisArg, args) {
          if (args[0] === "webgl2") return null;
          return Reflect.apply(target, thisArg, args);
        },
      });
    });

    await page.goto("/");
    await page.waitForTimeout(200);

    // The canvas itself is hidden -- the fallback doesn't touch it at all,
    // it paints via a sibling div's background-image/mask instead.
    const canvasDisplay = await page.locator("canvas.bg-grid-canvas").evaluate((el) => getComputedStyle(el).display);
    expect(canvasDisplay).toBe("none");

    const fallback = page.locator(".bg-grid-css-fallback");
    await expect(fallback).toBeAttached();
    const style = await fallback.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        backgroundImage: cs.backgroundImage,
        opacity: cs.opacity,
        maskImage: cs.maskImage || cs.webkitMaskImage,
      };
    });
    expect(style.backgroundImage).toContain("repeating-linear-gradient");
    expect(Number(style.opacity)).toBeGreaterThan(0);
    expect(style.maskImage).toContain("radial-gradient");

    expect(errors).toEqual([]);
  });
});
