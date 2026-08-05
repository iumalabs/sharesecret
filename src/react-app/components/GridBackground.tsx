import { useEffect, useRef } from "react";

/**
 * Canvas-rendered background grid with a cursor "gravity well": grid nodes
 * within RADIUS of the pointer are pulled toward it and light up, with a
 * soft halo following the cursor. Ported from the design mockup's
 * grid-webgl.js (WebGL2, shader-based analytical line rendering).
 *
 * Falls back to a pure-CSS grid (repeating background-image gradients + a
 * radial-gradient mask for the cursor spotlight) when WebGL2 isn't
 * available, matching the design mockup's own fallback strategy.
 *
 * Respects prefers-reduced-motion: draws a single static frame / skips
 * pointer tracking instead of the interactive version.
 */

const STEP = 74; // grid spacing, css px
const RADIUS = 300; // pointer influence radius
const PULL = 26; // max node displacement toward the pointer

const VERT_SRC = `#version 300 es
in vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG_SRC = `#version 300 es
precision highp float;
uniform vec2 u_res;       // device px
uniform vec2 u_mouse;     // device px, eased
uniform float u_power;
uniform vec3 u_col;
uniform float u_step;
uniform float u_radius;
uniform float u_pull;
uniform float u_lw;       // 1 device px, used to scale hairline widths
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
  float line = 1.0 - smoothstep(u_lw * 0.6, u_lw * 1.9, min(g.x, g.y));

  vec2 nd = (fract(uv - 0.5) - 0.5) * u_step;
  float node = (1.0 - smoothstep(0.0, 1.2 + f * 2.4, length(nd))) * f;

  float veil = clamp(1.0 - max(0.0, p.y - u_res.y * 0.38) / (u_res.y * 1.25), 0.0, 1.0);

  float a = clamp((line * (0.15 + f * 0.7) + node * 0.95) * veil + f * f * 0.1, 0.0, 1.0);
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

function setupWebGL(canvas: HTMLCanvasElement, reducedMotion: boolean): (() => void) | null {
  // preserveDrawingBuffer: true matters more than the perf cost suggests --
  // without it, the browser is free to clear the drawing buffer right after
  // compositing each frame. For the single-static-frame reduced-motion path
  // that's fatal (nothing redraws it, so it can end up blank on screen);
  // even in the animated path it's a real risk on backgrounded/throttled
  // tabs where the next rAF-driven redraw is delayed.
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
  const uPower = gl.getUniformLocation(program, "u_power");
  const uCol = gl.getUniformLocation(program, "u_col");
  const uStep = gl.getUniformLocation(program, "u_step");
  const uRadius = gl.getUniformLocation(program, "u_radius");
  const uPull = gl.getUniformLocation(program, "u_pull");
  const uLw = gl.getUniformLocation(program, "u_lw");

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  const state = { dpr: 1 };
  const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, power: 0, tpower: 0 };

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

  let rgb = accentRgbFloat();

  function draw() {
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.uniform2f(uMouse, mouse.x * state.dpr, mouse.y * state.dpr);
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

// Pure-CSS fallback for browsers without WebGL2: a repeating-gradient grid
// plus a radial-gradient mask so it still fades toward the bottom of the
// screen and spotlights the cursor, without ever touching a canvas.
function setupCssFallback(host: HTMLDivElement, reducedMotion: boolean): () => void {
  const step = `${STEP}px`;
  const color = "var(--accent, #a78bfa)";
  host.style.backgroundImage = `repeating-linear-gradient(90deg, ${color} 0 1px, transparent 1px ${step}), ` +
    `repeating-linear-gradient(0deg, ${color} 0 1px, transparent 1px ${step})`;
  host.style.opacity = "0.16";
  host.style.setProperty("--gx", "50%");
  host.style.setProperty("--gy", "30%");
  const mask = "radial-gradient(320px at var(--gx,50%) var(--gy,30%), #000, rgba(0,0,0,.35) 70%), " +
    "linear-gradient(#000 40%, transparent)";
  host.style.setProperty("mask-image", mask);
  host.style.setProperty("-webkit-mask-image", mask);
  host.style.setProperty("mask-composite", "intersect");
  host.style.setProperty("-webkit-mask-composite", "source-in");

  if (reducedMotion) return () => {};

  function move(e: PointerEvent | TouchEvent) {
    const p = "touches" in e ? e.touches[0] : e;
    if (!p) return;
    host.style.setProperty("--gx", `${p.clientX}px`);
    host.style.setProperty("--gy", `${p.clientY}px`);
  }
  window.addEventListener("pointermove", move, { passive: true });
  window.addEventListener("touchmove", move, { passive: true });

  return () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("touchmove", move);
  };
}

export default function GridBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const fallback = fallbackRef.current;
    if (!canvas || !fallback) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const webglCleanup = setupWebGL(canvas, reducedMotion);
    if (webglCleanup) return webglCleanup;

    canvas.style.display = "none";
    return setupCssFallback(fallback, reducedMotion);
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="bg-grid-canvas" aria-hidden="true" />
      <div ref={fallbackRef} className="bg-grid-css-fallback" aria-hidden="true" />
    </>
  );
}
