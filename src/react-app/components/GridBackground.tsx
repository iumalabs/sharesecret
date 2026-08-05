import { useEffect, useRef } from "react";

/**
 * Canvas-rendered background grid with a cursor "gravity well": grid nodes
 * within RADIUS of the pointer are pulled toward it and light up, with a
 * soft halo following the cursor. Ported from the design mockup's
 * grid-webgl.js (WebGL2, shader-based analytical line rendering), which
 * replaced the mockup's original grid.js (Canvas 2D) -- the 2D version's
 * sub-pixel-width, low-alpha strokes rendered inconsistently across real
 * GPU/driver/browser combinations in a way that never showed up in this
 * repo's own dev-environment pixel checks, only on real end-user hardware.
 * Falls back to the old Canvas 2D approach if WebGL2 isn't available.
 *
 * Respects prefers-reduced-motion: draws a single static frame (no pointer
 * tracking, no animation loop) instead of the interactive version.
 */

const STEP = 74; // grid spacing, css px
const RADIUS = 300; // pointer influence radius
const PULL = 26; // max node displacement toward the pointer
// Canvas-2D fallback only. 0.055 (design mockup) then 0.12 (GH #23) both
// proved imperceptible on real displays; 0.26 was still reported invisible
// on real hardware (see SS-002 follow-up) -- turned out to be a rendering
// reliability issue with thin Canvas-2D strokes, not just contrast, which
// is why the primary path below is WebGL now instead of a fourth alpha bump.
const REST_ALPHA = 0.26;

// ?grid-debug=1 renders the grid at high-visibility settings, in a color
// that can't be confused with the real accent, plus a pointer-position
// marker -- lets pointer reactivity be verified by eye without guessing
// whether a dim glow is "working but subtle" or not firing at all.
const DEBUG_COLOR = "255,0,255";
const DEBUG_ALPHA = 0.85;

const VERT_SRC = `#version 300 es
in vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG_SRC = `#version 300 es
precision highp float;
uniform vec2 u_res;       // device px
uniform vec2 u_mouse;     // device px, eased (drives the warp/glow)
uniform vec2 u_mouseRaw;  // device px, un-eased (debug marker only)
uniform float u_power;
uniform vec3 u_col;
uniform float u_step;
uniform float u_radius;
uniform float u_pull;
uniform float u_lw;       // 1 device px, used to scale hairline widths
uniform float u_debug;
out vec4 outColor;

void main() {
  vec2 p = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
  vec2 d = p - u_mouse;
  float dist = length(d);

  // gravity well: sample the grid at a point pushed away from the cursor,
  // which reads as the lines being pulled toward it
  float f = pow(max(0.0, 1.0 - dist / u_radius), 2.1) * u_power;
  vec2 q = p + normalize(d + vec2(1e-5)) * (u_pull * f);

  vec2 uv = q / u_step;
  vec2 g = abs(fract(uv - 0.5) - 0.5) * u_step;
  float line = 1.0 - smoothstep(u_lw * 0.5, u_lw * 1.6, min(g.x, g.y));

  vec2 nd = (fract(uv - 0.5) - 0.5) * u_step;
  float node = (1.0 - smoothstep(0.0, 1.2 + f * 2.4, length(nd))) * f;

  float veil = clamp(1.0 - max(0.0, p.y - u_res.y * 0.15) / (u_res.y * 1.05), 0.0, 1.0);

  if (u_debug > 0.5) {
    float ink = clamp(line + node, 0.0, 1.0);
    vec2 rd = p - u_mouseRaw;
    float rdist = length(rd);
    float ring = 1.0 - smoothstep(0.0, 2.0 * u_lw, abs(rdist - 14.0 * u_lw));
    float crossH = step(abs(rd.y), u_lw) * step(abs(rd.x), 20.0 * u_lw);
    float crossV = step(abs(rd.x), u_lw) * step(abs(rd.y), 20.0 * u_lw);
    float marker = clamp(ring + crossH + crossV, 0.0, 1.0);
    float a = clamp(ink * 0.85 + marker, 0.0, 1.0);
    outColor = vec4(vec3(1.0, 0.0, 1.0) * a, a);
    return;
  }

  float a = clamp((line * (0.12 + f * 0.62) + node * 0.95) * veil + f * f * 0.09, 0.0, 1.0);
  vec3 c = u_col * clamp(1.0 + f * 0.6, 0.0, 2.0);
  outColor = vec4(c * a, a); // premultiplied
}`;

function accentRgbFloat(): [number, number, number] {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  if (!value.startsWith("#")) return [167 / 255, 139 / 255, 250 / 255];
  const hex = value.length === 4
    ? value
      .slice(1)
      .split("")
      .map((c) => parseInt(c + c, 16))
    : [value.slice(1, 3), value.slice(3, 5), value.slice(5, 7)].map((c) => parseInt(c, 16));
  return [hex[0] / 255, hex[1] / 255, hex[2] / 255];
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("grid: shader compile failed", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function setupWebGL(
  canvas: HTMLCanvasElement,
  debugMode: boolean,
  reducedMotion: boolean,
): (() => void) | null {
  // preserveDrawingBuffer: true matters more than the perf cost suggests --
  // without it, the browser is free to clear the drawing buffer right after
  // compositing each frame. For the single-static-frame reduced-motion path
  // that's fatal (nothing redraws it, so it can end up blank on screen);
  // even in the animated path it's a real risk on backgrounded/throttled
  // tabs where the next rAF-driven redraw is delayed. Confirmed via a
  // readback test: without this flag, a canvas known (from a separate
  // gl.getError()-clean draw) to have rendered correctly still read back as
  // all-zero alpha shortly afterward.
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) return null;

  const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
  if (!vert || !frag) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("grid: program link failed", gl.getProgramInfoLog(program));
    return null;
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const posLoc = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(program, "u_res");
  const uMouse = gl.getUniformLocation(program, "u_mouse");
  const uMouseRaw = gl.getUniformLocation(program, "u_mouseRaw");
  const uPower = gl.getUniformLocation(program, "u_power");
  const uCol = gl.getUniformLocation(program, "u_col");
  const uStep = gl.getUniformLocation(program, "u_step");
  const uRadius = gl.getUniformLocation(program, "u_radius");
  const uPull = gl.getUniformLocation(program, "u_pull");
  const uLw = gl.getUniformLocation(program, "u_lw");
  const uDebug = gl.getUniformLocation(program, "u_debug");

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  const state = { dpr: 1 };
  const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, power: 0, tpower: 0 };
  let loggedFirstPointer = false;

  function resize() {
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * state.dpr);
    canvas.height = Math.round(h * state.dpr);
    gl!.viewport(0, 0, canvas.width, canvas.height);
    gl!.uniform2f(uRes, canvas.width, canvas.height);
    gl!.uniform1f(uStep, STEP * state.dpr);
    gl!.uniform1f(uRadius, RADIUS * state.dpr);
    gl!.uniform1f(uPull, PULL * state.dpr);
    gl!.uniform1f(uLw, state.dpr);
  }
  resize();
  gl.uniform1f(uDebug, debugMode ? 1 : 0);

  if (debugMode) {
    console.log(`grid-debug: on (webgl), dpr=${state.dpr}, canvas=${canvas.width}x${canvas.height}`);
  }

  let rgb = accentRgbFloat();

  function draw() {
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.uniform2f(uMouse, mouse.x * state.dpr, mouse.y * state.dpr);
    gl!.uniform2f(uMouseRaw, mouse.tx * state.dpr, mouse.ty * state.dpr);
    gl!.uniform1f(uPower, mouse.power);
    gl!.uniform3f(uCol, rgb[0], rgb[1], rgb[2]);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
  }

  if (reducedMotion) {
    // Static resting-state frame only: no pointer at (-9999,-9999) means
    // the shader's warp/glow terms stay at zero.
    draw();
    return () => {};
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
    if (tick % 60 === 0) rgb = accentRgbFloat();

    mouse.x += (mouse.tx - mouse.x) * 0.12;
    mouse.y += (mouse.ty - mouse.y) * 0.12;
    mouse.power += (mouse.tpower - mouse.power) * 0.06;

    draw();
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
}

type Point = [x: number, y: number, glow: number];

function setupCanvas2D(canvas: HTMLCanvasElement, debugMode: boolean, reducedMotion: boolean): () => void {
  const ctx = canvas.getContext("2d")!;

  const state = { w: 0, h: 0, dpr: 1, cols: 0, rows: 0 };
  const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, power: 0, tpower: 0 };
  let loggedFirstPointer = false;

  function accentRgb(): [number, number, number] {
    const value = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    if (!value.startsWith("#")) return [167, 139, 250];
    const hex = value.length === 4
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
    canvas.width = Math.round(state.w * state.dpr);
    canvas.height = Math.round(state.h * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    state.cols = Math.ceil(state.w / STEP) + 2;
    state.rows = Math.ceil(state.h / STEP) + 2;
  }
  resize();

  if (debugMode) {
    console.log(`grid-debug: on (canvas2d fallback), dpr=${state.dpr}, canvas=${canvas.width}x${canvas.height}`);
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
      ctx.strokeStyle = `rgba(${DEBUG_COLOR},${DEBUG_ALPHA})`;
      ctx.lineWidth = 1 + glow * 1.5;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
      ctx.stroke();
      return;
    }
    const fade = veil((p[1] + q[1]) / 2);
    const alpha = (REST_ALPHA + glow * 0.5) * fade;
    if (alpha < 0.004) return;
    ctx.strokeStyle = `rgba(${col},${alpha.toFixed(3)})`;
    ctx.lineWidth = 0.8 + glow * 1.5;
    ctx.shadowBlur = glow > 0.25 ? 14 * glow : 0;
    ctx.shadowColor = `rgba(${col},${(glow * 0.6).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(q[0], q[1]);
    ctx.stroke();
  }

  function frame() {
    const col = `${rgb[0]},${rgb[1]},${rgb[2]}`;
    ctx.clearRect(0, 0, state.w, state.h);
    ctx.lineCap = "round";

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

    ctx.shadowBlur = 0;
    for (let gy = 0; gy < state.rows; gy++) {
      for (let gx = 0; gx < state.cols; gx++) {
        warp(gx, gy, a);
        if (a[2] < 0.12) continue;
        const al = a[2] * 0.85 * veil(a[1]);
        ctx.fillStyle = `rgba(${col},${al.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(a[0], a[1], 0.8 + a[2] * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (mouse.power > 0.02) {
      const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, RADIUS * 0.8);
      g.addColorStop(0, `rgba(${col},${(0.1 * mouse.power).toFixed(3)})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(mouse.x - RADIUS, mouse.y - RADIUS, RADIUS * 2, RADIUS * 2);
    }

    if (debugMode && mouse.tx > -9999) {
      ctx.strokeStyle = `rgba(${DEBUG_COLOR},1)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mouse.tx, mouse.ty, 14, 0, Math.PI * 2);
      ctx.moveTo(mouse.tx - 20, mouse.ty);
      ctx.lineTo(mouse.tx + 20, mouse.ty);
      ctx.moveTo(mouse.tx, mouse.ty - 20);
      ctx.lineTo(mouse.tx, mouse.ty + 20);
      ctx.stroke();
    }
  }

  if (reducedMotion) {
    frame();
    return () => {};
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
}

export default function GridBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const debugMode = new URLSearchParams(window.location.search).get("grid-debug") === "1";

    const webglCleanup = setupWebGL(canvas, debugMode, reducedMotion);
    if (webglCleanup) return webglCleanup;

    if (debugMode) console.log("grid-debug: WebGL2 unavailable, falling back to Canvas 2D");
    return setupCanvas2D(canvas, debugMode, reducedMotion);
  }, []);

  return <canvas ref={canvasRef} className="bg-grid-canvas" aria-hidden="true" />;
}
