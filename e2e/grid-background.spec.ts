import { expect, test } from "./fixtures";

// Regression coverage for GridBackground.tsx: WebGL2 is the primary render
// path (ported from the design mockup's grid-webgl.js), with a pure-CSS grid
// as the fallback for browsers without WebGL2. These tests sample whichever
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

  test("falls back to CSS if the WebGL2 shaders fail to compile", async ({ page }) => {
    await page.addInitScript(() => {
      const orig = WebGL2RenderingContext.prototype.getShaderParameter;
      WebGL2RenderingContext.prototype.getShaderParameter = function (shader, pname) {
        if (pname === (this as WebGL2RenderingContext).COMPILE_STATUS) return false;
        return orig.call(this, shader, pname);
      };
    });

    await page.goto("/");
    await page.waitForTimeout(200);

    const canvasDisplay = await page.locator("canvas.bg-grid-canvas").evaluate((el) => getComputedStyle(el).display);
    expect(canvasDisplay).toBe("none");
    await expect(page.locator(".bg-grid-css-fallback")).toBeAttached();
  });

  test("falls back to CSS if the WebGL2 program fails to link", async ({ page }) => {
    await page.addInitScript(() => {
      const orig = WebGL2RenderingContext.prototype.getProgramParameter;
      WebGL2RenderingContext.prototype.getProgramParameter = function (program, pname) {
        if (pname === (this as WebGL2RenderingContext).LINK_STATUS) return false;
        return orig.call(this, program, pname);
      };
    });

    await page.goto("/");
    await page.waitForTimeout(200);

    const canvasDisplay = await page.locator("canvas.bg-grid-canvas").evaluate((el) => getComputedStyle(el).display);
    expect(canvasDisplay).toBe("none");
    await expect(page.locator(".bg-grid-css-fallback")).toBeAttached();
  });

  test("reads a shorthand 4-digit hex --accent value without erroring", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.addInitScript(() => {
      // document.head doesn't exist yet at addInitScript's run time (it
      // executes before the document is parsed) -- wait for it.
      function inject() {
        const style = document.createElement("style");
        style.textContent = ":root { --accent: #abc; }";
        document.head.appendChild(style);
      }
      if (document.head) inject();
      else document.addEventListener("DOMContentLoaded", inject);
    });

    await page.goto("/");
    await page.waitForTimeout(200);

    const sample = await sampleGridCanvas(page);
    expect(sample.found).toBe(true);
    expect(sample.nonZeroAlphaPixels).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test("the WebGL pointer glow turns off on document mouseleave", async ({ page }) => {
    await page.goto("/");
    await page.mouse.move(200, 200);
    await page.waitForTimeout(150);
    const withPointer = await sampleGridCanvas(page);

    await page.evaluate(() => document.dispatchEvent(new MouseEvent("mouseleave")));
    // The eased pointer "power" decays toward 0 over subsequent frames --
    // give it a moment, then confirm the grid is still drawing (not just
    // that alpha dropped, which fluctuates frame to frame anyway).
    await page.waitForTimeout(150);
    const afterLeave = await sampleGridCanvas(page);
    expect(afterLeave.found).toBe(true);
    expect(withPointer.found).toBe(true);
  });

  test("CSS-fallback grid tracks the pointer position", async ({ page }) => {
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.getContext = new Proxy(HTMLCanvasElement.prototype.getContext, {
        apply(target, thisArg, args) {
          if (args[0] === "webgl2") return null;
          return Reflect.apply(target, thisArg, args);
        },
      });
    });
    await page.goto("/");

    const fallback = page.locator(".bg-grid-css-fallback");
    const before = await fallback.evaluate((el) => getComputedStyle(el).getPropertyValue("--gx"));

    await page.mouse.move(321, 123);
    await page.waitForTimeout(100);

    const after = await fallback.evaluate((el) => getComputedStyle(el).getPropertyValue("--gx"));
    expect(after).not.toBe(before);
    expect(after.trim()).toBe("321px");
  });

  test("a non-hex --accent value falls back to the default accent color without erroring", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.addInitScript(() => {
      function inject() {
        const style = document.createElement("style");
        style.textContent = ":root { --accent: rgb(1, 2, 3); }";
        document.head.appendChild(style);
      }
      if (document.head) inject();
      else document.addEventListener("DOMContentLoaded", inject);
    });

    await page.goto("/");
    await page.waitForTimeout(200);

    const sample = await sampleGridCanvas(page);
    expect(sample.found).toBe(true);
    expect(sample.nonZeroAlphaPixels).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test("falls back to CSS if the browser refuses to allocate a shader object", async ({ page }) => {
    await page.addInitScript(() => {
      WebGL2RenderingContext.prototype.createShader = () => null;
    });

    await page.goto("/");
    await page.waitForTimeout(200);

    const canvasDisplay = await page.locator("canvas.bg-grid-canvas").evaluate((el) => getComputedStyle(el).display);
    expect(canvasDisplay).toBe("none");
    await expect(page.locator(".bg-grid-css-fallback")).toBeAttached();
  });

  test("resize() falls back to window dimensions when the canvas itself has no laid-out size", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "devicePixelRatio", { value: 0, configurable: true });
      function inject() {
        const style = document.createElement("style");
        style.textContent = "canvas.bg-grid-canvas { width: 0 !important; height: 0 !important; }";
        document.head.appendChild(style);
      }
      if (document.head) inject();
      else document.addEventListener("DOMContentLoaded", inject);
    });

    await page.goto("/");
    await page.waitForTimeout(200);

    // With clientWidth/clientHeight forced to 0, resize() falls back to
    // window.innerWidth/innerHeight -- the backing store should still end up
    // sized to the viewport rather than staying 0x0.
    const size = await page.locator("canvas.bg-grid-canvas").evaluate((el: HTMLCanvasElement) => ({
      width: el.width,
      height: el.height,
    }));
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
  });

  test("the WebGL pointer glow responds to touch move events, not just mouse/pointer", async ({ page }) => {
    await page.goto("/");
    // Dispatched structurally rather than via a real TouchEvent constructor
    // (headless Chromium doesn't emulate touch hardware by default) -- the
    // handler only branches on `"touches" in e`, so a plain Event carrying a
    // touches-shaped property exercises the same code path.
    await page.evaluate(() => {
      const ev = new Event("touchmove");
      Object.defineProperty(ev, "touches", { value: [{ clientX: 150, clientY: 150 }] });
      window.dispatchEvent(ev);
    });
    await page.waitForTimeout(150);

    const sample = await sampleGridCanvas(page);
    expect(sample.found).toBe(true);
    expect(sample.nonZeroAlphaPixels).toBeGreaterThan(0);

    // An empty touches list (e.g. a stray touchmove after the last finger
    // lifted) should be a no-op, not throw on an undefined touch point.
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.evaluate(() => {
      const ev = new Event("touchmove");
      Object.defineProperty(ev, "touches", { value: [] });
      window.dispatchEvent(ev);
    });
    await page.waitForTimeout(50);
    expect(errors).toEqual([]);
  });

  test("the CSS-fallback grid responds to touch move events, not just mouse/pointer", async ({ page }) => {
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.getContext = new Proxy(HTMLCanvasElement.prototype.getContext, {
        apply(target, thisArg, args) {
          if (args[0] === "webgl2") return null;
          return Reflect.apply(target, thisArg, args);
        },
      });
    });
    await page.goto("/");

    const fallback = page.locator(".bg-grid-css-fallback");
    const before = await fallback.evaluate((el) => getComputedStyle(el).getPropertyValue("--gx"));

    await page.evaluate(() => {
      const ev = new Event("touchmove");
      Object.defineProperty(ev, "touches", { value: [{ clientX: 77, clientY: 88 }] });
      window.dispatchEvent(ev);
    });
    await page.waitForTimeout(100);

    const after = await fallback.evaluate((el) => getComputedStyle(el).getPropertyValue("--gx"));
    expect(after).not.toBe(before);
    expect(after.trim()).toBe("77px");

    // Same empty-touches no-op check as the WebGL path above.
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.evaluate(() => {
      const ev = new Event("touchmove");
      Object.defineProperty(ev, "touches", { value: [] });
      window.dispatchEvent(ev);
    });
    await page.waitForTimeout(50);
    expect(errors).toEqual([]);
  });

  test("prefers-reduced-motion also skips pointer tracking on the CSS fallback path", async ({ page }) => {
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.getContext = new Proxy(HTMLCanvasElement.prototype.getContext, {
        apply(target, thisArg, args) {
          if (args[0] === "webgl2") return null;
          return Reflect.apply(target, thisArg, args);
        },
      });
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForTimeout(150);

    const fallback = page.locator(".bg-grid-css-fallback");
    const before = await fallback.evaluate((el) => getComputedStyle(el).getPropertyValue("--gx"));

    await page.mouse.move(555, 444);
    await page.waitForTimeout(100);

    // Reduced motion means the cleanup function returned immediately without
    // registering pointer listeners -- the spotlight position shouldn't move.
    const after = await fallback.evaluate((el) => getComputedStyle(el).getPropertyValue("--gx"));
    expect(after).toBe(before);
  });
});
