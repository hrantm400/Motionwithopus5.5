// motion.mjs — pure functions of time for seek(t) compositions.
//
// Nothing in this file keeps state between calls, so frame 812 renders without
// simulating frames 0–811, and the same t always gives the same picture.
// Served to the browser at /_studio/motion.mjs; Node can import it too.

// ── basics ──────────────────────────────────────────────────────────────────

export const clamp = (x, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x);
export const lerp = (a, b, k) => a + (b - a) * k;
export const invLerp = (a, b, x) => (a === b ? (x < a ? 0 : 1) : clamp((x - a) / (b - a)));
export const remap = (x, a, b, c, d, easeFn = ease.linear) => lerp(c, d, easeFn(invLerp(a, b, x)));

/** 0→1 progress through a window that opens at `start` and lasts `dur` seconds. */
export const progress = (t, start, dur) => (dur <= 0 ? (t < start ? 0 : 1) : clamp((t - start) / dur));

/** 1 while `t` is inside [start, end), else 0. */
export const between = (t, start, end) => (t >= start && t < end ? 1 : 0);

// ── easing: for properties that should NOT feel like they have mass ─────────
// (opacity, color, wipes, line drawing). Anything that moves gets a spring.

export const ease = {
  linear: (k) => k,
  inQuad: (k) => k * k,
  outQuad: (k) => 1 - (1 - k) * (1 - k),
  inOutQuad: (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2),
  inCubic: (k) => k * k * k,
  outCubic: (k) => 1 - (1 - k) ** 3,
  inOutCubic: (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2),
  outQuart: (k) => 1 - (1 - k) ** 4,
  inOutQuart: (k) => (k < 0.5 ? 8 * k ** 4 : 1 - (-2 * k + 2) ** 4 / 2),
  outQuint: (k) => 1 - (1 - k) ** 5,
  outExpo: (k) => (k >= 1 ? 1 : 1 - 2 ** (-10 * k)),
  inOutExpo: (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k < 0.5 ? 2 ** (20 * k - 10) / 2 : (2 - 2 ** (-20 * k + 10)) / 2),
  inOutSine: (k) => -(Math.cos(Math.PI * k) - 1) / 2,
};

/** CSS-style cubic-bezier(x1, y1, x2, y2) as a function of progress 0→1. */
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (u) => ((ax * u + bx) * u + cx) * u;
  const sy = (u) => ((ay * u + by) * u + cy) * u;
  const dx = (u) => (3 * ax * u + 2 * bx) * u + cx;
  return (k) => {
    if (k <= 0) return 0;
    if (k >= 1) return 1;
    let u = k;
    for (let i = 0; i < 8; i++) {
      const err = sx(u) - k;
      if (Math.abs(err) < 1e-6) return sy(u);
      const d = dx(u);
      if (Math.abs(d) < 1e-6) break;
      u -= err / d;
    }
    let lo = 0, hi = 1;
    u = k;
    for (let i = 0; i < 40; i++) {
      const x = sx(u);
      if (Math.abs(x - k) < 1e-6) break;
      if (x < k) lo = u; else hi = u;
      u = (lo + hi) / 2;
    }
    return sy(u);
  };
}

// ── springs: closed form, so they stay a pure function of time ──────────────
// A spring is described by its natural frequency (Hz) and damping ratio
// (<1 overshoots, 1 is critical, >1 is sluggish). spring() is the step
// response from 0 to 1 starting at rest at t = 0.

export function spring(t, { freq = 2, damping = 0.8 } = {}) {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * freq;
  const z = damping;
  if (Math.abs(z - 1) < 1e-6) return 1 - Math.exp(-w * t) * (1 + w * t);
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
  }
  const s = Math.sqrt(z * z - 1);
  const r1 = -w * (z - s), r2 = -w * (z + s);
  return 1 + (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r1 - r2);
}

/** d/dt of spring(): use it for squash, stretch or motion trails. */
export function springVelocity(t, { freq = 2, damping = 0.8 } = {}) {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * freq;
  const z = damping;
  if (Math.abs(z - 1) < 1e-6) return w * w * t * Math.exp(-w * t);
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z);
    return ((w * w) / wd) * Math.exp(-z * w * t) * Math.sin(wd * t);
  }
  const s = Math.sqrt(z * z - 1);
  const r1 = -w * (z - s), r2 = -w * (z + s);
  return (r1 * r2 * (Math.exp(r1 * t) - Math.exp(r2 * t))) / (r1 - r2);
}

/** Seconds until a spring stays within `tol` of its target. Use it to schedule beats. */
export function settleTime(feelSpec, tol = 0.01) {
  let last = 0;
  for (let t = 0; t < 10; t += 0.001) if (Math.abs(spring(t, feelSpec) - 1) > tol) last = t;
  return Math.round(last * 1000) / 1000;
}

/**
 * One rule per class of object. If everything overshoots, nothing feels precise.
 * (settle time to within 1%, from settleTime())
 *   ui       small controls snap, no visible overshoot          0.26 s
 *   panel    cards, sheets, containers settle with a hair of it  0.58 s
 *   camera   glides, never overshoots                           1.5 s
 *   headline lands hard, small overshoot, then holds             0.34 s
 *   mascot   bounces on purpose                                  0.83 s
 *   cursor   human pointer travel with a tiny correction          0.44 s
 */
export const feel = {
  ui: { freq: 3.2, damping: 0.9 },
  panel: { freq: 1.8, damping: 0.75 },
  camera: { freq: 0.7, damping: 1 },
  headline: { freq: 3.0, damping: 0.62 },
  mascot: { freq: 2.2, damping: 0.35 },
  cursor: { freq: 1.6, damping: 0.85 },
};

// ── tracks: a value that changes target several times ───────────────────────
// Stack one spring per change instead of restarting it:
//   track(t) = v0 + Σ (v_i − v_(i−1)) × spring(t − t_i)
// Because the spring is linear, this is the exact physical response to a
// target that jumps at each key, velocity carried through every retarget.
//
// keys: [[t0, v0], [t1, v1, feelOverride?], ...] — values are numbers or
// equal-length arrays (positions, OKLab colors).

function addScaled(acc, a, b, k) {
  if (typeof acc === 'number') return acc + (b - a) * k;
  for (let i = 0; i < acc.length; i++) acc[i] += (b[i] - a[i]) * k;
  return acc;
}

export function track(t, keys, feelSpec = feel.panel) {
  let acc = Array.isArray(keys[0][1]) ? keys[0][1].slice() : keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [ti, vi, f] = keys[i];
    if (t <= ti) break;
    acc = addScaled(acc, keys[i - 1][1], vi, spring(t - ti, f || feelSpec));
  }
  return acc;
}

export function trackVelocity(t, keys, feelSpec = feel.panel) {
  let acc = Array.isArray(keys[0][1]) ? keys[0][1].map(() => 0) : 0;
  for (let i = 1; i < keys.length; i++) {
    const [ti, vi, f] = keys[i];
    if (t <= ti) break;
    acc = addScaled(acc, keys[i - 1][1], vi, springVelocity(t - ti, f || feelSpec));
  }
  return acc;
}

/** Keyframes with easing between keys (After Effects style) for mass-less properties. */
export function keyframes(t, keys, easeFn = ease.inOutCubic) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t0, v0] = keys[i - 1];
    const [t1, v1, e] = keys[i];
    if (t < t1) {
      const k = (e || easeFn)(invLerp(t0, t1, t));
      return Array.isArray(v0) ? v0.map((x, j) => lerp(x, v1[j], k)) : lerp(v0, v1, k);
    }
  }
  return keys[keys.length - 1][1];
}

// ── state lists: one shape that morphs through the whole story ──────────────
// steps: [[time, 'stateName', feel?], ...]; defs: { stateName: { w, h, r, bg: '#hex', ... } }
// feels: one feel for every property, or { w: feel.panel, x: feel.cursor, default: feel.ui }.
// A feel on a step overrides it for that one change (a pop-in can bounce while
// the rest of the film settles). Missing properties inherit from the previous
// state. Colors morph in OKLab.

export function morph(t, steps, defs, feels = feel.panel) {
  for (let i = 1; i < steps.length; i++) if (steps[i][0] < steps[i - 1][0]) throw new Error(`morph(): steps must be sorted by time ("${steps[i][1]}" at ${steps[i][0]} comes after ${steps[i - 1][0]})`);
  const props = new Set();
  for (const [, name] of steps) {
    if (!defs[name]) throw new Error(`morph(): unknown state "${name}"`);
    Object.keys(defs[name]).forEach((p) => props.add(p));
  }
  const out = {};
  for (const p of props) {
    const keys = [];
    let prev;
    for (const [time, name, stepFeel] of steps) {
      const v = name in defs && p in defs[name] ? defs[name][p] : prev;
      if (v === undefined) continue;
      prev = v;
      keys.push([time, typeof v === 'string' ? toOklab(v) : v, stepFeel]);
    }
    if (!keys.length) continue;
    const f = feels.freq !== undefined ? feels : feels[p] || feels.default || feel.panel;
    const value = track(t, keys, f);
    out[p] = typeof prev === 'string' ? fromOklab(value) : value;
  }
  // which state is current, and how long ago it started
  let current = steps[0][1], since = t - steps[0][0];
  for (const [time, name] of steps) if (t >= time) { current = name; since = t - time; }
  out.state = current;
  out.since = since;
  return out;
}

// ── seeded randomness: never Math.random ────────────────────────────────────

/** Deterministic PRNG (mulberry32). Call it in setup, never inside seek(). */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stateless hash of integers → [0, 1). Safe inside seek(): hash01(i, seed). */
export function hash01(...ints) {
  let h = 0x811c9dc5;
  for (const n of ints) {
    h ^= n | 0;
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
}

/** Smooth 1D value noise in [-1, 1]. noise1(t * 2, 7) * 3 → 3 px organic drift. */
export function noise1(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash01(i, seed) * 2 - 1, hash01(i + 1, seed) * 2 - 1, u);
}

/** Smooth 2D value noise in [-1, 1]. */
export function noise2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const h = (a, b) => hash01(a, b, seed) * 2 - 1;
  return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
}

// ── text and rhythm ─────────────────────────────────────────────────────────

/**
 * Times at which each character of `text` appears when typed from `start`
 * at about `cps` characters per second, with seeded human unevenness.
 * Import the same function in score.mjs so every key click lands on its letter.
 */
export function typeTimes(text, start, cps = 16, seed = 1) {
  const times = [];
  let t = start;
  for (let i = 0; i < text.length; i++) {
    times.push(t);
    const pause = text[i] === ' ' ? 1.6 : 1;
    t += (pause * (0.55 + 0.9 * hash01(i, seed))) / cps;
  }
  return times;
}

/** The part of `text` visible at time t, given typeTimes(). */
export function typed(text, t, times) {
  let n = 0;
  while (n < times.length && t >= times[n]) n++;
  return text.slice(0, n);
}

/** Delay for item i in a stagger of `gap` seconds, optionally from the center. */
export function stagger(i, gap, { count = 0, from = 'start' } = {}) {
  if (from === 'center' && count) return Math.abs(i - (count - 1) / 2) * gap;
  if (from === 'end' && count) return (count - 1 - i) * gap;
  return i * gap;
}

/** Beat grid helpers for a constant tempo. */
export const beatLength = (bpm) => 60 / bpm;
export const beatAt = (n, bpm, offset = 0) => offset + n * (60 / bpm);
/** Phase within the current beat, 0→1, and the beat index. */
export function beatPhase(t, bpm, offset = 0) {
  const x = (t - offset) / (60 / bpm);
  const n = Math.floor(x);
  return { n, phase: x - n };
}

// ── color: hex ↔ OKLab, so morphs stay perceptually even ────────────────────

function srgbToLinear(c) { return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
function linearToSrgb(c) { return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; }

export function parseHex(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
}

export function toOklab(hex) {
  const [r8, g8, b8, a] = parseHex(hex);
  const r = srgbToLinear(r8 / 255), g = srgbToLinear(g8 / 255), b = srgbToLinear(b8 / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    a,
  ];
}

export function fromOklab([L, A, B, alpha = 1]) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const r = linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const b = linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  const c = (x) => Math.round(clamp(x) * 255);
  const a = clamp(alpha);
  return a >= 0.999 ? `rgb(${c(r)}, ${c(g)}, ${c(b)})` : `rgba(${c(r)}, ${c(g)}, ${c(b)}, ${a.toFixed(3)})`;
}

/** Perceptual mix of two hex colors, k = 0 → a, k = 1 → b. */
export function mixColor(a, b, k) {
  const A = toOklab(a), B = toOklab(b);
  return fromOklab(A.map((x, i) => lerp(x, B[i], clamp(k))));
}

/** Spring-tracked color: keys are [[t, '#hex'], ...]. */
export function trackColor(t, keys, feelSpec = feel.panel) {
  return fromOklab(track(t, keys.map(([tk, hex, f]) => [tk, toOklab(hex), f]), feelSpec));
}

// ── geometry ────────────────────────────────────────────────────────────────

/** Point on a quadratic bezier: lets a cursor travel on an arc, not a ruler line. */
export function arc(p0, p1, k, bend = 0.18) {
  const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
  const cx = mx - dy * bend, cy = my + dx * bend;
  const u = 1 - k;
  return [u * u * p0[0] + 2 * u * k * cx + k * k * p1[0], u * u * p0[1] + 2 * u * k * cy + k * k * p1[1]];
}

/**
 * A cursor path through waypoints [[t, x, y], ...]: at each time the pointer
 * sets off for the next point, travels on a gentle arc and arrives with cursor
 * feel. Legs are stacked like track(), so overlapping moves blend smoothly.
 */
export function cursorPath(t, waypoints, feelSpec = feel.cursor, bend = 0.12) {
  let x = waypoints[0][1], y = waypoints[0][2];
  for (let i = 1; i < waypoints.length; i++) {
    const [ti, xi, yi] = waypoints[i];
    if (t <= ti) break;
    const k = spring(t - ti, feelSpec);
    const dx = xi - waypoints[i - 1][1], dy = yi - waypoints[i - 1][2];
    const b = bend * Math.sin(Math.PI * clamp(k)) * (i % 2 ? 1 : -1);
    x += dx * k - dy * b;
    y += dy * k + dx * b;
  }
  return [x, y];
}
