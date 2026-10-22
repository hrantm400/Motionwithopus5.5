// timeline.mjs — the one clock for {{TITLE}}.
//
// index.html (picture) and score.mjs (sound) both import this file, so every
// state change and every hit land on the same frame. Plain data and arithmetic
// only: no imports, no DOM. Rewrite it from shotlist.md.

const D = {{DURATION}};
const bpm = 120;
const beat = 60 / bpm;
const snap = (t) => Math.round(t / beat) * beat; // keep every change on the beat grid

// When the cursor presses something.
const clicks = [snap(D * 0.3), snap(D * 0.73)];

export default {
  duration: D,
  fps: {{FPS}},
  formats: {{FORMATS}},
  bpm,

  shots: [
    { name: 'HOOK', start: 0, end: D * 0.13 },
    { name: 'PROBLEM', start: D * 0.13, end: D * 0.33 },
    { name: 'REVEAL', start: D * 0.33, end: D * 0.6 },
    { name: 'PROOF', start: D * 0.6, end: D * 0.87 },
    { name: 'CLOSE', start: D * 0.87, end: D },
  ],

  // The one shape that never cuts: [time, state] (states live in index.html).
  steps: [[0, 'dot'], [snap(D * 0.07), 'pill'], [clicks[0] + 0.05, 'card'], [snap(D * 0.5), 'wide'], [clicks[1] + 0.05, 'pill'], [snap(D * 0.9), 'dot']],

  clicks,

  // Cursor waypoints [time it sets off, x, y] as fractions of the frame.
  cursor: [[0, 0.86, 1.08], [clicks[0] - 0.6, 0.52, 0.53], [clicks[0] + 0.5, 0.8, 0.78], [snap(D * 0.5) - 0.5, 0.66, 0.6], [clicks[1] - 0.6, 0.53, 0.52], [clicks[1] + 0.5, 0.86, 1.08]],

  // The moments sound must hit: review.mjs checks each one has a sound on it.
  get cues() {
    return [
      ...this.clicks.map((t) => ({ t, label: 'click' })),
      ...this.steps.slice(1).map(([t, s]) => ({ t, label: s })),
    ].sort((a, b) => a.t - b.t);
  },
};
