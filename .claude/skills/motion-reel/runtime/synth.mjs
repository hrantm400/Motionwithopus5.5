// synth.mjs — deterministic score and SFX in plain JavaScript.
//
// Sound runs on the same clock as the picture: score.mjs reads the same
// timeline.mjs as index.html and places every hit at the exact second the
// picture changes. No samples, no Web Audio graph, no randomness: the same
// input gives the same samples on every render, in Node and in the browser.
// Served at /_studio/synth.mjs.

export const SAMPLE_RATE = 48000;

const TAU = Math.PI * 2;
const LN1000 = Math.log(1000); // decay times are "time to -60 dB"
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
export const db = (d) => 10 ** (d / 20);

// ── mix bus ─────────────────────────────────────────────────────────────────

/** A stereo bus with a reverb send. Every instrument below adds into it. */
export function createMix(duration, sampleRate = SAMPLE_RATE) {
  const length = Math.max(1, Math.ceil(duration * sampleRate));
  return {
    sampleRate,
    duration,
    length,
    left: new Float32Array(length),
    right: new Float32Array(length),
    sendL: new Float32Array(length),
    sendR: new Float32Array(length),
  };
}

function seedFrom(t, salt) {
  let h = (Math.round(t * 1000) ^ Math.imul(salt | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0 || 1;
}

/** Seeded white noise in [-1, 1). */
export function noiseSource(seed = 1) {
  let s = seed >>> 0 || 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

/** Seeded pink-ish noise (Paul Kellet's economy filter). */
export function pinkSource(seed = 1) {
  const white = noiseSource(seed);
  let b0 = 0, b1 = 0, b2 = 0;
  return () => {
    const w = white();
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    return (b0 + b1 + b2 + w * 0.1848) * 0.25;
  };
}

/**
 * Write one voice into the mix. gen(s) returns a mono sample for s seconds
 * after the voice starts; it is called once per sample, in order, so it may
 * keep its own oscillator and filter state.
 */
export function voice(mix, t, dur, gen, { gain = 0, pan = 0, verb = 0, panAt = null } = {}) {
  const sr = mix.sampleRate;
  const start = Math.round(t * sr);
  const n = Math.max(0, Math.round(dur * sr));
  const g = db(gain);
  const angle = (p) => ((clamp(p, -1, 1) + 1) * Math.PI) / 4;
  let gl = Math.cos(angle(pan)), gr = Math.sin(angle(pan));
  for (let k = 0; k < n; k++) {
    const s = k / sr;
    const x = gen(s) * g;
    const i = start + k;
    if (i < 0) continue;
    if (i >= mix.length) break;
    if (panAt) { const a = angle(panAt(s)); gl = Math.cos(a); gr = Math.sin(a); }
    const l = x * gl, r = x * gr;
    mix.left[i] += l;
    mix.right[i] += r;
    if (verb) {
      mix.sendL[i] += l * verb;
      mix.sendR[i] += r * verb;
    }
  }
}

// ── building blocks ─────────────────────────────────────────────────────────

/** RBJ biquad. set() may be called per block to sweep the cutoff. */
export class Biquad {
  constructor(type = 'lp', freq = 1000, q = 0.707, sampleRate = SAMPLE_RATE) {
    this.sr = sampleRate;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
    this.set(type, freq, q);
  }
  set(type, freq, q = 0.707) {
    const w0 = (TAU * clamp(freq, 10, this.sr * 0.45)) / this.sr;
    const cos = Math.cos(w0), alpha = Math.sin(w0) / (2 * q);
    let b0, b1, b2;
    if (type === 'hp') { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = b0; }
    else if (type === 'bp') { b0 = alpha; b1 = 0; b2 = -alpha; }
    else { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = b0; }
    const a0 = 1 + alpha;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0;
    this.a1 = (-2 * cos) / a0; this.a2 = (1 - alpha) / a0;
    return this;
  }
  process(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

function polyblep(p, dt) {
  if (p < dt) { p /= dt; return p + p - p * p - 1; }
  if (p > 1 - dt) { p = (p - 1) / dt; return p * p + p + p + 1; }
  return 0;
}

/** Band-limited oscillator: call with the current frequency, get one sample. */
export function oscillator(type = 'sine', phase0 = 0, sampleRate = SAMPLE_RATE) {
  let p = phase0 % 1;
  return (freq) => {
    const dt = freq / sampleRate;
    let y;
    if (type === 'saw') y = 2 * p - 1 - polyblep(p, dt);
    else if (type === 'square') y = (p < 0.5 ? 1 : -1) + polyblep(p, dt) - polyblep((p + 0.5) % 1, dt);
    else if (type === 'tri') y = 1 - 4 * Math.abs(p - 0.5);
    else y = Math.sin(TAU * p);
    p += dt;
    if (p >= 1) p -= Math.floor(p);
    return y;
  };
}

/** Exponential decay to -60 dB over `decay` seconds after a linear attack. */
export const perc = (s, attack, decay) =>
  s < attack ? s / attack : Math.exp((-LN1000 * (s - attack)) / Math.max(decay, 1e-4));

/** ADSR with a gate of `hold` seconds. Times in seconds, sustain 0–1. */
export function adsr(s, hold, { a = 0.005, d = 0.1, s: sus = 0.7, r = 0.2 } = {}) {
  let v;
  if (s < a) v = s / a;
  else if (s < a + d) v = 1 - (1 - sus) * ((s - a) / d);
  else v = sus;
  if (s > hold) v *= Math.exp((-LN1000 * (s - hold)) / Math.max(r, 1e-4));
  return v;
}

const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** 'A4' → 440, 'C#3' → 138.59, 'Eb5' → 622.25 */
export function noteHz(name) {
  if (typeof name === 'number') return name;
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(name.trim());
  if (!m) throw new Error(`noteHz(): bad note "${name}"`);
  const semis = NOTE_INDEX[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const midi = (Number(m[3]) + 1) * 12 + semis;
  return 440 * 2 ** ((midi - 69) / 12);
}

const CHORDS = { maj: [0, 4, 7], min: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], sus2: [0, 2, 7], sus4: [0, 5, 7], add9: [0, 4, 7, 14] };
/** chordHz('A3', 'min7') → [220, 261.6, 329.6, 392] */
export function chordHz(root, quality = 'maj') {
  const f = noteHz(root);
  return (CHORDS[quality] || CHORDS.maj).map((st) => f * 2 ** (st / 12));
}

// ── percussion ──────────────────────────────────────────────────────────────

export function kick(mix, t, { gain = 0, decay = 0.45, pitch = 1, click = 1, verb = 0 } = {}) {
  const osc = oscillator('sine', 0, mix.sampleRate);
  const nz = noiseSource(seedFrom(t, 1));
  const hp = new Biquad('hp', 2500, 0.7, mix.sampleRate);
  voice(mix, t, decay + 0.05, (s) => {
    const f = pitch * (46 + 130 * Math.exp(-s / 0.032));
    const body = osc(f) * perc(s, 0.002, decay);
    const tick = hp.process(nz()) * perc(s, 0.0005, 0.012) * 0.6 * click;
    return Math.tanh(1.8 * (body + tick)) * 0.8;
  }, { gain, verb });
}

export function snare(mix, t, { gain = -2, decay = 0.22, tone = 1, verb = 0.12 } = {}) {
  const o1 = oscillator('sine', 0, mix.sampleRate), o2 = oscillator('sine', 0.25, mix.sampleRate);
  const nz = noiseSource(seedFrom(t, 2));
  const bp = new Biquad('bp', 1900, 0.8, mix.sampleRate), hp = new Biquad('hp', 900, 0.7, mix.sampleRate);
  voice(mix, t, decay + 0.05, (s) => {
    const body = (o1(185) * 0.6 + o2(330) * 0.3) * perc(s, 0.001, 0.09) * tone;
    const rattle = hp.process(bp.process(nz())) * perc(s, 0.001, decay) * 2.2;
    return Math.tanh(body + rattle) * 0.7;
  }, { gain, verb });
}

export function clap(mix, t, { gain = -3, verb = 0.2 } = {}) {
  const nz = noiseSource(seedFrom(t, 3));
  const bp = new Biquad('bp', 1250, 1.1, mix.sampleRate);
  voice(mix, t, 0.35, (s) => {
    const bursts = [0, 0.011, 0.022].reduce((e, o) => e + (s >= o ? perc(s - o, 0.0005, 0.03) : 0), 0);
    const tail = s >= 0.03 ? perc(s - 0.03, 0.001, 0.25) * 0.5 : 0;
    return bp.process(nz()) * (bursts + tail) * 1.8;
  }, { gain, verb });
}

export function hat(mix, t, { gain = -10, open = false, pan = 0.15, verb = 0.05 } = {}) {
  const nz = noiseSource(seedFrom(t, 4));
  const hp = new Biquad('hp', 7200, 0.7, mix.sampleRate), bp = new Biquad('bp', 10500, 0.9, mix.sampleRate);
  const decay = open ? 0.32 : 0.05;
  voice(mix, t, decay + 0.02, (s) => bp.process(hp.process(nz())) * perc(s, 0.0005, decay) * 2.5, { gain, pan, verb });
}

// ── interface sounds ────────────────────────────────────────────────────────

/** A crisp UI click: put it on the exact frame the cursor presses. */
export function click(mix, t, { gain = -8, pitch = 1, pan = 0, verb = 0.04 } = {}) {
  const o = oscillator('sine', 0, mix.sampleRate), thump = oscillator('sine', 0, mix.sampleRate);
  const nz = noiseSource(seedFrom(t, 5));
  const hp = new Biquad('hp', 3000, 0.8, mix.sampleRate);
  voice(mix, t, 0.06, (s) =>
    o(2300 * pitch) * perc(s, 0.0005, 0.018) * 0.5 +
    hp.process(nz()) * perc(s, 0.0002, 0.006) * 0.7 +
    thump(170 * pitch) * perc(s, 0.001, 0.03) * 0.6,
  { gain, pan, verb });
}

/** A soft key tap for typed text. Use typeTimes() so each tap lands on its letter. */
export function keyTap(mix, t, { gain = -16, pan = 0, verb = 0.03 } = {}) {
  const nz = noiseSource(seedFrom(t, 6));
  const jitter = 0.85 + 0.3 * ((seedFrom(t, 7) % 1000) / 1000);
  const bp = new Biquad('bp', 3200 * jitter, 1.6, mix.sampleRate);
  const o = oscillator('sine', 0, mix.sampleRate);
  voice(mix, t, 0.04, (s) => bp.process(nz()) * perc(s, 0.0003, 0.02) * 2 + o(950 * jitter) * perc(s, 0.0005, 0.01) * 0.25, { gain, pan, verb });
}

/** A rounded pop for things that appear: tiles, badges, toasts. */
export function pop(mix, t, { gain = -10, pitch = 1, pan = 0, verb = 0.1 } = {}) {
  const o = oscillator('sine', 0, mix.sampleRate);
  voice(mix, t, 0.16, (s) => o(pitch * (420 + 520 * (1 - Math.exp(-s / 0.012)))) * perc(s, 0.002, 0.11), { gain, pan, verb });
}

/** Bell-like success chime; several notes arpeggiate by `spread` seconds. */
export function chime(mix, t, { notes = ['E6'], gain = -12, decay = 1.4, spread = 0.07, pan = 0, verb = 0.35 } = {}) {
  const partials = [[1, 1], [2.76, 0.45], [5.4, 0.22], [8.93, 0.1]];
  notes.forEach((n, j) => {
    const f = noteHz(n);
    const oscs = partials.map((_, i) => oscillator('sine', i * 0.13, mix.sampleRate));
    voice(mix, t + j * spread, decay + 0.1, (s) =>
      partials.reduce((acc, [ratio, amp], i) => acc + oscs[i](f * ratio) * amp * perc(s, 0.002, decay / (1 + i * 0.8)), 0) * 0.4,
    { gain, pan: pan + (j % 2 ? 0.2 : -0.2), verb });
  });
}

// ── transitions ─────────────────────────────────────────────────────────────

/**
 * Filtered-noise whoosh that PEAKS at `at`: put `at` on the cut or the frame
 * where the move is fastest. It starts 70% of `dur` earlier.
 */
export function whoosh(mix, at, { dur = 0.7, gain = -8, from = 250, to = 5200, q = 1.1, pan = [-0.5, 0.5], verb = 0.2 } = {}) {
  const pre = dur * 0.7, post = dur * 0.3;
  const nz = pinkSource(seedFrom(at, 8));
  const bp = new Biquad('bp', from, q, mix.sampleRate);
  let k = 0;
  voice(mix, at - pre, dur, (s) => {
    if (k++ % 16 === 0) {
      const u = clamp(s / pre, 0, 1);
      bp.set('bp', from * (to / from) ** u, q);
    }
    const env = s < pre ? (s / pre) ** 2.2 : Math.exp((-LN1000 * (s - pre)) / (post * 1.4));
    return bp.process(nz()) * env * 3.2;
  }, { gain, verb, panAt: (s) => pan[0] + (pan[1] - pan[0]) * clamp(s / dur, 0, 1) });
}

/** Noise-and-saw riser that ENDS at `at` (put `at` on the downbeat it builds into). */
export function riser(mix, at, { dur = 2, gain = -12, from = 180, to = 900, verb = 0.25 } = {}) {
  const nz = noiseSource(seedFrom(at, 9));
  const hp = new Biquad('hp', 200, 0.8, mix.sampleRate), lp = new Biquad('lp', 800, 0.9, mix.sampleRate);
  const saw = oscillator('saw', 0, mix.sampleRate), saw2 = oscillator('saw', 0.37, mix.sampleRate);
  let k = 0;
  voice(mix, at - dur, dur, (s) => {
    const u = clamp(s / dur, 0, 1);
    if (k++ % 16 === 0) { hp.set('hp', 200 * 30 ** u, 0.8); lp.set('lp', 600 * 10 ** u, 0.9); }
    const f = from * (to / from) ** u;
    const tone = lp.process(saw(f) + saw2(f * 1.005)) * 0.25;
    return (hp.process(nz()) * 0.6 + tone) * u ** 2.4;
  }, { gain, verb });
}

/** Sub drop plus noise burst for reveals and logo hits. */
export function impact(mix, t, { gain = -4, size = 1, verb = 0.35 } = {}) {
  const sub = oscillator('sine', 0, mix.sampleRate);
  const nz = noiseSource(seedFrom(t, 10));
  const lp = new Biquad('lp', 1400, 0.7, mix.sampleRate);
  const decay = 1.1 * size;
  voice(mix, t, decay + 0.1, (s) => {
    const body = sub(32 + 26 * Math.exp(-s / 0.18)) * perc(s, 0.003, decay);
    const crack = lp.process(nz()) * perc(s, 0.001, 0.28 * size) * 0.9;
    return Math.tanh(2 * (body + crack)) * 0.85;
  }, { gain, verb });
}

// ── tonal ───────────────────────────────────────────────────────────────────

/**
 * Generic synth voice. note: 'A3' or Hz. type: sine | tri | saw | square.
 * cutoff + filterEnv give plucks and basses their shape; glide slides pitch.
 */
export function tone(mix, t, {
  note = 'A4', dur = 0.4, type = 'saw', gain = -14, pan = 0, verb = 0.1,
  a = 0.005, d = 0.12, s = 0.6, r = 0.18, cutoff = 2400, q = 0.8,
  filterEnv = 0, filterDecay = 0.15, glide = null, detune = 0, unison = 1,
} = {}) {
  const f0 = noteHz(note);
  const f1 = glide ? noteHz(glide.to) : f0;
  const gTime = glide ? glide.time || 0.08 : 0;
  const oscs = Array.from({ length: unison }, (_, i) => oscillator(type, i * 0.31, mix.sampleRate));
  const spread = (i) => (unison === 1 ? 0 : (i / (unison - 1) - 0.5) * 2 * detune);
  const lp = new Biquad('lp', cutoff, q, mix.sampleRate);
  let k = 0;
  voice(mix, t, dur + r * 1.2, (sec) => {
    if (k++ % 16 === 0) lp.set('lp', cutoff * (1 + filterEnv * Math.exp(-sec / filterDecay)), q);
    const f = gTime ? f0 + (f1 - f0) * clamp(sec / gTime, 0, 1) : f0;
    let x = 0;
    for (let i = 0; i < unison; i++) x += oscs[i](f * 2 ** (spread(i) / 1200));
    return lp.process(x / Math.sqrt(unison)) * adsr(sec, dur, { a, d, s, r });
  }, { gain, pan, verb });
}

/** Slow detuned-saw pad: the bed under a film. notes: ['A3','C4','E4'] or chordHz(). */
export function pad(mix, t, { notes = ['A3', 'C4', 'E4'], dur = 4, gain = -20, a = 0.8, r = 1.2, cutoff = 1300, detune = 9, verb = 0.5 } = {}) {
  notes.forEach((n, i) =>
    tone(mix, t, { note: n, dur, type: 'saw', gain, a, d: 0.4, s: 0.85, r, cutoff, q: 0.6, detune, unison: 3, verb, pan: (i % 2 ? 1 : -1) * 0.35 }),
  );
}

// ── rhythm ──────────────────────────────────────────────────────────────────

/**
 * Times of the hits in a step pattern like 'x...x...x..Xx...'.
 * x = hit, X = accent, anything else = rest. 16 steps per bar by default.
 * Pure: the composition can import it to animate on the same hits.
 */
export function patternTimes({ bpm, pattern, start = 0, bars = 1, steps = 16, swing = 0 }) {
  const step = (60 / bpm) * (4 / steps);
  const out = [];
  for (let bar = 0; bar < bars; bar++) {
    [...pattern].forEach((c, i) => {
      if (c !== 'x' && c !== 'X') return;
      const sw = i % 2 ? swing * step : 0;
      out.push({ t: start + (bar * pattern.length + i) * step + sw, accent: c === 'X' });
    });
  }
  return out;
}

const DRUMS = { kick, snare, clap, hat, ohat: (m, t, o) => hat(m, t, { ...o, open: true }), click, pop };

/**
 * Drum sequencer. tracks: { kick: 'x...x...', hat: '..x...x.' }, gains in dB per track.
 * Returns { kick: [times], hat: [times], ... } so the picture can use the same hits.
 */
export function pattern(mix, { bpm, start = 0, bars = 1, steps = 16, swing = 0, tracks = {}, gains = {}, until = Infinity }) {
  const hits = {};
  for (const [name, pat] of Object.entries(tracks)) {
    const fn = DRUMS[name];
    if (!fn) throw new Error(`pattern(): unknown track "${name}" (use ${Object.keys(DRUMS).join(', ')})`);
    hits[name] = [];
    for (const { t, accent } of patternTimes({ bpm, pattern: pat, start, bars, steps, swing })) {
      if (t >= until) continue;
      fn(mix, t, { gain: (gains[name] ?? (name === 'hat' ? -10 : 0)) + (accent ? 3 : 0) });
      hits[name].push(t);
    }
  }
  return hits;
}

// ── master ──────────────────────────────────────────────────────────────────

function comb(len, feedback, damp) {
  const buf = new Float32Array(len);
  let i = 0, store = 0;
  return (x) => {
    const y = buf[i];
    store = y * (1 - damp) + store * damp;
    buf[i] = x + store * feedback;
    i = (i + 1) % len;
    return y;
  };
}
function allpass(len, fb = 0.5) {
  const buf = new Float32Array(len);
  let i = 0;
  return (x) => {
    const b = buf[i];
    const y = -x + b;
    buf[i] = x + b * fb;
    i = (i + 1) % len;
    return y;
  };
}

/** Freeverb-style room on the send bus, mixed back into left/right. */
export function reverb(mix, { size = 0.8, damp = 0.35, wet = 1 } = {}) {
  const k = mix.sampleRate / 44100;
  const make = (offset) => ({
    combs: [1116, 1188, 1277, 1356, 1422, 1491].map((d) => comb(Math.round((d + offset) * k), size * 0.28 + 0.7, damp)),
    aps: [556, 441, 341].map((d) => allpass(Math.round((d + offset) * k))),
  });
  const L = make(0), R = make(23);
  for (let i = 0; i < mix.length; i++) {
    const inL = mix.sendL[i] * 0.06, inR = mix.sendR[i] * 0.06;
    let yl = 0, yr = 0;
    for (const c of L.combs) yl += c(inL);
    for (const c of R.combs) yr += c(inR);
    for (const a of L.aps) yl = a(yl);
    for (const a of R.aps) yr = a(yr);
    mix.left[i] += yl * wet;
    mix.right[i] += yr * wet;
  }
  mix.sendL.fill(0);
  mix.sendR.fill(0);
  return mix;
}

/**
 * Finish the mix: reverb, a gentle saturating limiter and a short fade at the
 * very end so the file never ends on a click. Loudness (-14 LUFS) is set by
 * the renderer with ffmpeg afterwards; this only keeps peaks under control.
 */
export function master(mix, { verb = {}, drive = 1.1, fadeOut = 0.02 } = {}) {
  if (verb !== false) reverb(mix, verb);
  let peak = 0;
  for (let i = 0; i < mix.length; i++) peak = Math.max(peak, Math.abs(mix.left[i]), Math.abs(mix.right[i]));
  if (peak > 0) {
    const pre = 0.9 / peak;
    for (let i = 0; i < mix.length; i++) {
      mix.left[i] = Math.tanh(mix.left[i] * pre * drive) / Math.tanh(drive);
      mix.right[i] = Math.tanh(mix.right[i] * pre * drive) / Math.tanh(drive);
    }
  }
  const nf = Math.min(mix.length, Math.round(fadeOut * mix.sampleRate));
  for (let j = 0; j < nf; j++) {
    const g = j / nf;
    mix.left[mix.length - 1 - j] *= g;
    mix.right[mix.length - 1 - j] *= g;
  }
  return mix;
}

/** 32-bit float stereo WAV (lossless; loudness is normalized downstream). */
export function toWav(mix) {
  const n = mix.length, channels = 2, bytes = 4;
  const buf = new ArrayBuffer(44 + n * channels * bytes);
  const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n * channels * bytes, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 3, true); v.setUint16(22, channels, true);
  v.setUint32(24, mix.sampleRate, true); v.setUint32(28, mix.sampleRate * channels * bytes, true);
  v.setUint16(32, channels * bytes, true); v.setUint16(34, bytes * 8, true);
  str(36, 'data'); v.setUint32(40, n * channels * bytes, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    v.setFloat32(o, mix.left[i], true); o += 4;
    v.setFloat32(o, mix.right[i], true); o += 4;
  }
  return new Uint8Array(buf);
}
