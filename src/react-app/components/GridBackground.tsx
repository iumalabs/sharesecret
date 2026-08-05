import { useEffect, useRef } from "react";

/**
 * Canvas-rendered background grid with a cursor "gravity well": grid nodes
 * within RADIUS of the pointer are pulled toward it and light up, with a
 * soft halo following the cursor. Ported from the design mockup's grid.js.
 *
 * Respects prefers-reduced-motion: draws a single static frame (no pointer
 * tracking, no animation loop) instead of the interactive version.
 */

const STEP = 74; // grid spacing, css px
const RADIUS = 300; // pointer influence radius
const PULL = 26; // max node displacement toward the pointer
// 0.055 (design mockup) then 0.12 (GH #23) both proved imperceptible on real
// displays -- confirmed again on real 2K/4K/Mac M4 hardware (see SS-002).
// 0.26 roughly doubles line alpha again over the 0.12 attempt, landing in
// the "thin visible lines at rest" range the design reference shows.
const REST_ALPHA = 0.26;

// ?grid-debug=1 renders the grid at high-visibility settings, in a color
// that can't be confused with the real accent, plus a pointer-position
// marker -- lets pointer reactivity be verified by eye without guessing
// whether a dim glow is "working but subtle" or not firing at all.
const DEBUG_COLOR = "255,0,255";
const DEBUG_ALPHA = 0.85;

type Point = [x: number, y: number, glow: number];

export default function GridBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const debugMode = new URLSearchParams(window.location.search).get("grid-debug") === "1";
    let loggedFirstPointer = false;

    const state = { w: 0, h: 0, dpr: 1, cols: 0, rows: 0 };
    const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, power: 0, tpower: 0 };

    function accentRgb(): [number, number, number] {
      const value = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
      if (!value.startsWith("#")) return [167, 139, 250];
      const hex =
        value.length === 4
          ? value
              .slice(1)
              .split("")
              .map((c) => parseInt(c + c, 16))
          : [value.slice(1, 3), value.slice(3, 5), value.slice(5, 7)].map((c) => parseInt(c, 16));
      return [hex[0], hex[1], hex[2]];
    }
    let rgb = accentRgb();

    function resize() {
      state.dpr = Math.min(window.devicePixelRatio || 1, 2);
      state.w = window.innerWidth;
      state.h = window.innerHeight;
      canvas!.width = Math.round(state.w * state.dpr);
      canvas!.height = Math.round(state.h * state.dpr);
      ctx!.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      state.cols = Math.ceil(state.w / STEP) + 2;
      state.rows = Math.ceil(state.h / STEP) + 2;
    }
    resize();

    if (debugMode) {
      console.log(`grid-debug: on, dpr=${state.dpr}, canvas=${canvas.width}x${canvas.height}`);
    }

    function warp(gx: number, gy: number, out: Point) {
      const bx = gx * STEP - STEP;
      const by = gy * STEP - STEP;
      const dx = mouse.x - bx;
      const dy = mouse.y - by;
      const d = Math.hypot(dx, dy);
      if (d > RADIUS || mouse.power < 0.01) {
        out[0] = bx;
        out[1] = by;
        out[2] = 0;
        return;
      }
      const f = Math.pow(1 - d / RADIUS, 2.1) * mouse.power;
      const k = (PULL * f) / (d || 1);
      out[0] = bx + dx * k;
      out[1] = by + dy * k;
      out[2] = f;
    }

    const a: Point = [0, 0, 0];
    const b: Point = [0, 0, 0];

    function veil(y: number): number {
      return Math.max(0, 1 - Math.max(0, y - state.h * 0.15) / (state.h * 1.05));
    }

    function seg(p: Point, q: Point, col: string) {
      const glow = Math.max(p[2], q[2]);
      if (debugMode) {
        ctx!.strokeStyle = `rgba(${DEBUG_COLOR},${DEBUG_ALPHA})`;
        ctx!.lineWidth = 1 + glow * 1.5;
        ctx!.shadowBlur = 0;
        ctx!.beginPath();
        ctx!.moveTo(p[0], p[1]);
        ctx!.lineTo(q[0], q[1]);
        ctx!.stroke();
        return;
      }
      const fade = veil((p[1] + q[1]) / 2);
      const alpha = (REST_ALPHA + glow * 0.5) * fade;
      if (alpha < 0.004) return;
      ctx!.strokeStyle = `rgba(${col},${alpha.toFixed(3)})`;
      ctx!.lineWidth = 0.8 + glow * 1.5;
      ctx!.shadowBlur = glow > 0.25 ? 14 * glow : 0;
      ctx!.shadowColor = `rgba(${col},${(glow * 0.6).toFixed(3)})`;
      ctx!.beginPath();
      ctx!.moveTo(p[0], p[1]);
      ctx!.lineTo(q[0], q[1]);
      ctx!.stroke();
    }

    function frame() {
      const col = `${rgb[0]},${rgb[1]},${rgb[2]}`;
      ctx!.clearRect(0, 0, state.w, state.h);
      ctx!.lineCap = "round";

      for (let gy = 0; gy < state.rows; gy++) {
        for (let gx = 0; gx < state.cols - 1; gx++) {
          warp(gx, gy, a);
          warp(gx + 1, gy, b);
          seg(a, b, col);
        }
      }
      for (let gx = 0; gx < state.cols; gx++) {
        for (let gy = 0; gy < state.rows - 1; gy++) {
          warp(gx, gy, a);
          warp(gx, gy + 1, b);
          seg(a, b, col);
        }
      }

      ctx!.shadowBlur = 0;
      for (let gy = 0; gy < state.rows; gy++) {
        for (let gx = 0; gx < state.cols; gx++) {
          warp(gx, gy, a);
          if (a[2] < 0.12) continue;
          const al = a[2] * 0.85 * veil(a[1]);
          ctx!.fillStyle = `rgba(${col},${al.toFixed(3)})`;
          ctx!.beginPath();
          ctx!.arc(a[0], a[1], 0.8 + a[2] * 2.2, 0, Math.PI * 2);
          ctx!.fill();
        }
      }

      if (mouse.power > 0.02) {
        const g = ctx!.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, RADIUS * 0.8);
        g.addColorStop(0, `rgba(${col},${(0.1 * mouse.power).toFixed(3)})`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx!.fillStyle = g;
        ctx!.fillRect(mouse.x - RADIUS, mouse.y - RADIUS, RADIUS * 2, RADIUS * 2);
      }

      if (debugMode && mouse.tx > -9999) {
        ctx!.strokeStyle = `rgba(${DEBUG_COLOR},1)`;
        ctx!.lineWidth = 2;
        ctx!.beginPath();
        ctx!.arc(mouse.tx, mouse.ty, 14, 0, Math.PI * 2);
        ctx!.moveTo(mouse.tx - 20, mouse.ty);
        ctx!.lineTo(mouse.tx + 20, mouse.ty);
        ctx!.moveTo(mouse.tx, mouse.ty - 20);
        ctx!.lineTo(mouse.tx, mouse.ty + 20);
        ctx!.stroke();
      }
    }

    if (reducedMotion) {
      // Static resting-state frame only: no pointer at (-9999,-9999) means
      // every node warps to its base position with zero glow.
      frame();
      return;
    }

    function move(e: PointerEvent | TouchEvent) {
      const p = "touches" in e ? e.touches[0] : e;
      if (!p) return;
      mouse.tx = p.clientX;
      mouse.ty = p.clientY;
      mouse.tpower = 1;
      if (debugMode && !loggedFirstPointer) {
        loggedFirstPointer = true;
        console.log(`grid-debug: first pointer event at (${p.clientX}, ${p.clientY})`);
      }
    }
    function onPointerDown(e: PointerEvent) {
      move(e);
      mouse.tpower = 1.7;
    }
    function onPointerUp() {
      mouse.tpower = 1;
    }
    function onMouseLeave() {
      mouse.tpower = 0;
    }

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    document.addEventListener("mouseleave", onMouseLeave);

    let tick = 0;
    let rafId: number;

    function loop() {
      rafId = requestAnimationFrame(loop);
      tick++;
      if (tick % 60 === 0) rgb = accentRgb();

      mouse.x += (mouse.tx - mouse.x) * 0.12;
      mouse.y += (mouse.ty - mouse.y) * 0.12;
      mouse.power += (mouse.tpower - mouse.power) * 0.06;

      frame();
    }
    loop();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="bg-grid-canvas" aria-hidden="true" />;
}
