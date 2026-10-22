# Writing the composition

How to write `films/<slug>/src/index.html` so it renders the same way every time,
in every format. Read once before GATE 3; come back to the pitfalls when the
review flags something.

Contents: the contract · defineFilm · formats and layout · the motion library ·
assets · performance · pitfalls · footage and generate-then-trace

## The contract

- `seek(t, ctx)` paints the frame at second `t`. Nothing else may change the picture.
- Frames are rendered in parallel pages, in any order. Frame 812 must come out
  identical whether or not 0–811 were drawn first in that page.
- Everything time-based is a pure function of `t`: springs in closed form, seeded
  noise, typed text from precomputed key times.

The runtime helps: it replaces `Math.random` with a seeded generator (so
setup-time scatter is identical in every page), switches off CSS transitions and
animations, waits for fonts and images, counts clock and timer calls made inside
`seek()` and reports them, and refuses to render when an asset fails to load.
`review.mjs` then renders one frame three ways and compares the pixels.

## defineFilm

```html
<div id="stage"> … your elements … </div>
<script type="module">
import { defineFilm } from '/_studio/runtime.mjs';
import { morph, spring, feel, track, progress, ease } from '/_studio/motion.mjs';
import tl from './timeline.mjs';

defineFilm({
  duration: tl.duration,            // seconds (required)
  fps: 60,
  formats: ['16x9', '9x16'],        // or { wide: [1920, 1080], story: [1080, 1920] }
  timeline: { shots: tl.shots, cues: tl.cues },   // labels sheets; cues are sync-checked
  audio: { score: './score.mjs' },  // and/or track: '../assets/audio/song.wav', trackGain: -3, trackOffset: 12.5
  loop: true,                       // review checks the seam
  poster: 6.2,                      // poster frame time (default: middle of the last shot)
  async setup(ctx) {},              // build DOM, preload — once per page
  seek(t, ctx) {},                  // paint frame t — every frame
});
</script>
```

`ctx = { format, width, height, orientation, stage, render, params }`.
Standard formats: `16x9` 1920×1080, `9x16` 1080×1920, `1x1` 1080×1080, `4x5` 1080×1350.
`/_studio/` is served by the scripts (Node resolves it too), so ES-module imports
work in preview, render and score alike. Never open the file from `file://`.

`timeline.mjs` is plain data and arithmetic — no DOM, and no imports except JSON
data such as `beats.json` (`import beats from './beats.json' with { type: 'json' }`)
— because `score.mjs` imports it in Node.

## Formats and layout

Every aspect ratio comes from the same timeline, never from a crop.

- Size everything from `ctx.width`/`ctx.height` (or a `layout(W, H)` function that
  returns all positions and sizes per format). Do not use `vw`/`vh`: the preview
  scales the stage, the viewport is not the film.
- `<html>` carries `data-format` and `data-orientation` (`landscape` / `portrait` /
  `square`) for CSS, plus `--film-w` / `--film-h`.
- Vertical: bigger type relative to width, fewer elements, nothing important in the
  platform zones — top 220 px, bottom 420 px, right 140 px from y≈920 to 1500.
  Check with `render.mjs --stills shots --format 9x16 --guides`.
- Square: tighter holds. Wide: more spatial context, can carry two columns.

## The motion library (`/_studio/motion.mjs`)

All pure. `t` in seconds.

**Basics** — `clamp(x, lo, hi)`, `lerp(a, b, k)`, `invLerp(a, b, x)`,
`remap(x, a, b, c, d, easeFn)`, `progress(t, start, dur)` (0→1 window),
`between(t, a, b)`.

**Easing** (for mass-less properties: opacity, color fades, wipes, line drawing) —
`ease.linear … ease.outCubic, inOutCubic, outQuart, outExpo, inOutExpo, inOutSine`,
`cubicBezier(x1, y1, x2, y2)` to match a reference's curve,
`keyframes(t, [[t0, v0], [t1, v1, easeFn?], …], easeFn)`.

**Springs** (for anything that moves) — `spring(t, { freq, damping })` is the
closed-form step response 0→1; `springVelocity()` its derivative (squash, stretch,
trails); `settleTime(feel)` to schedule the next beat.
Presets, one per object class (settle time to 1%):

| feel | use | settles |
|---|---|---|
| `feel.ui` | buttons, chips, toggles, tiles — snap, no visible overshoot | 0.26 s |
| `feel.panel` | cards, sheets, the morphing container | 0.58 s |
| `feel.camera` | camera moves — glide, never overshoot | 1.5 s |
| `feel.headline` | headlines — land hard, small overshoot, hold | 0.34 s |
| `feel.cursor` | pointer travel with a tiny correction | 0.44 s |
| `feel.mascot` | bounce on purpose | 0.83 s |

**Tracks** — a value that changes target several times stacks one spring per
change instead of restarting: `track(t, [[t0, v0], [t1, v1, feel?], …], feel)`.
Values may be numbers or arrays. This is the exact physical response of a spring
whose target jumps at each key, velocity carried through, and frame 812 never
simulates 0–811. `trackVelocity()` likewise.

**State lists** — `morph(t, steps, states, feels)`:

```js
const states = {
  dot:    { x: 1500, y: 400, w: 64,   h: 64,  r: 32, bg: '#FF4F1A' },
  button: { x: 960,  y: 540, w: 420,  h: 96,  r: 48, bg: '#111111' },
  card:   { x: 960,  y: 520, w: 1100, h: 620, r: 24 },          // bg inherited
};
const steps = [[0, 'dot'], [1.5, 'button', feel.headline], [4.0, 'card']];
const m = morph(t, steps, states, { default: feel.panel, bg: { freq: 60, damping: 1 } });
// m.x, m.y, m.w, m.h, m.r, m.bg (css color), m.state, m.since
```

Strings that look like colors morph in OKLab. A feel on a step overrides it for
that change; a per-property feel map gives each property its own physics (above:
geometry settles, color cuts in one frame). Steps must be sorted.

**Cursor** — `cursorPath(t, [[tSetOff, x, y], …], feel.cursor, bend)` travels on
gentle arcs; legs stack like tracks. Clicks: put a press at the arrival time and
derive the squash from `t − press` (e.g. `Math.exp(-(t - press) * 16)`).

**Text** — `typeTimes(text, start, cps, seed)` precomputes when each character
appears (seeded human unevenness); `typed(text, t, times)` returns the visible
part. Import the same function in `score.mjs` so every key tap lands on its
letter. Caret blink: `Math.floor((t - start) / 0.25) % 2`.

**Randomness** — `rng(seed)` (a generator: use it in setup), `hash01(i, j, seed)`
(stateless: safe in seek), `noise1(x, seed)`, `noise2(x, y, seed)` for organic
drift (`noise1(t * 2, 7) * 3` px).

**Rhythm** — `beatAt(n, bpm)`, `beatPhase(t, bpm)`, `stagger(i, gap, { from: 'center', count })`.

**Color** — `mixColor(a, b, k)` (OKLab), `trackColor(t, keys, feel)`,
`toOklab`, `fromOklab`, `parseHex`.

## Assets

- Fonts: ship the files in `assets/fonts/` and declare them with `@font-face`
  (`url('../assets/fonts/X.woff2')`). The runtime loads every declared face before
  frame 0. Never rely on system fonts — they differ between machines.
- Images: `<img src="../assets/screens/x.png">` in the markup or created in
  `setup()`; the runtime waits for each to decode. CSS `background-image` is not
  waited for — prefer `<img>`.
- A failed load stops the render with the path. That is the point: a missing
  product screen is a question for the user, not a placeholder to draw.

## Performance

A frame costs ~40–120 ms to capture at 1080p (software raster), so 900 frames take
roughly a minute on 3 workers. Keep it that way:

- animate `transform` and `opacity`; set width/height only on the few elements that
  morph
- hundreds of particles → one `<canvas>` drawn in `seek()`, not hundreds of divs
- no filters/blur on large layers unless the shot needs them (they are slow in
  software raster)
- build all DOM in `setup()`; `seek()` only sets properties

## Pitfalls the review catches

- **State leaking between frames.** Caching anything computed in `seek()` (a
  position, a measured size, "the last state") and reading it in a later frame.
  Compute it from `t` with a pure function every time. Symptom: determinism FAIL
  "after other frames".
- **Hidden containers that aren't.** `visibility: hidden` on a parent does not hide
  children that were set `visible` earlier — old elements reappear in later shots.
  Hide groups with `display: none`, and set every property of every visible element
  each frame.
- **Creating elements in `seek()`.** Build them in `setup()`.
- **Paths through text.** A shape that morphs across the frame can sweep through a
  headline that is still leaving. Choreograph in two moves (drop beside the text,
  then stretch below it) or delay the move until the text is gone. Look at
  `strip.png`.
- **Muddy color.** Tweening ink into a saturated accent passes through brown for
  a dozen frames. Cut color on the beat (`{ freq: 60, damping: 1 }`) or wipe it.
- **One black frame.** When one layer hides on frame N and the next appears on
  N+1, the strip shows a flash. Overlap them by a frame.
- **Clock reads.** `Date.now()`, `performance.now()`, timers inside `seek()` —
  reported by render as contract violations.
- **Tiny raster noise.** Determinism may report "raster noise only: 2 px, max Δ8":
  Chromium's compositor, invisible, fine. Dozens of pixels or more is a real leak.
- **Text that wraps at every space.** Absolutely positioned children of an
  absolutely positioned container with no width shrink to min-content: "600+ pairs"
  breaks into two lines. Give the container the stage size, or `white-space: nowrap`.
- **Descenders left behind by a masked exit.** A line that leaves its mask by 112 %
  of its height still shows the bottom of its g, p and y for a frame or two; leave
  by 125 %.
- **An empty first frame.** On a feed the first frame is the thumbnail. Start the
  opening motion before t = 0 (negative start times) so frame 0 already moves.
- **A push that strobes.** A full-frame push in half a second peaks around 120 px
  per frame at 1080p, and the eye sees the steps. Blur horizontally by the distance
  travelled in a frame (a 180° shutter): an SVG `<filter id="mblur"><feGaussianBlur
  stdDeviation="0 0"/></filter>`, then in `seek()` set `stdDeviation` to
  `0.15 * Math.abs(x(t) - x(t - 1 / fps))` px and `filter: url(#mblur)` on the moving
  layers (`none` below 0.5 px). It depends on `t` only, so it stays deterministic.
- **Handoffs in the same space.** When the next chapter lands where the last one
  stands, end the exit on the downbeat and start the entry on it; the cut is two or
  three near-empty frames, never two headlines on top of each other.
- **Small print on a phone.** A 16:9 film watched 360 px wide shrinks 25 px type to
  under 5 px. Legal lines and badges: 30 px or more at 1080p.

## Footage and generate-then-trace

Code loses on photoreal scenes, complex characters and organic movement. Two
honest ways to combine:

- **Footage layer.** Extract frames once: `ffmpeg -i assets/clip.mp4 -vf fps=60
  assets/frames/%05d.jpg`. In `seek()` show frame `Math.round(t * 60) + 1` in an
  `<img>`, and make `seek` async: `img.src = …; await img.decode();` (the renderer
  awaits it). Avoid `<video>` seeking — it is not frame-exact.
- **Generate-then-trace.** A video model renders base shots for characters and
  physics; the film redraws everything in code on top, using the footage only as
  the timing and pose reference, so viewers see only the code-drawn layer. Keep the
  base frames in `refs/`, not in the final picture, and say so in the brief.
