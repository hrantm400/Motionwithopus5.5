// timeline.mjs — the one clock for "seek(t)".
//
// index.html (picture) and score.mjs (sound) both import this file, so every
// state change and every hit land on the same frame. 120 bpm: a beat is 0.5 s,
// a bar is 2 s, the film is 8 bars. Plain data and arithmetic only.

const bpm = 120;
const beat = 60 / bpm;
const at = (n) => n * beat; // beat n

export default {
  duration: 16,
  fps: 60,
  formats: ['16x9', '9x16'],
  bpm,
  beat,

  shots: [
    { name: 'HOOK', start: 0, end: 2 },
    { name: 'RULE', start: 2, end: 5 },
    { name: 'CRITIC', start: 5, end: 9 },
    { name: 'FORMATS', start: 9, end: 13 },
    { name: 'CLOSE', start: 13, end: 16 },
  ],

  // the hairline grid draws in at the top and retracts at the end (loop)
  grid: { in: 0, out: 15.3 },

  // the one shape that never cuts
  steps: [
    [0, 'hidden'],
    [at(0.5), 'dot'],
    [at(4), 'low'], // the dot drops beside the text, then stretches below it
    [at(4.4), 'scrubber'],
    [at(10), 'sheet'],
    [at(18), 'frame'],
    [at(26), 'cta'],
    [at(30.4), 'dot'],
    [at(31.1), 'hidden'],
  ],

  headline: { lines: ['A film', 'is a function', 'of time.'], at: [at(1), at(2), at(3)], out: at(3.5) },

  // RULE: the cursor grabs the playhead and drags it around; the preview
  // follows instantly. [time of the drag, playhead time it lands on]
  grab: at(5.6),
  scrub: [[at(6), 1.2], [at(7), 9.6], [at(8), 3.4], [at(9), 6.6]],
  release: at(9.5),

  captions: [
    { t: at(4.5), text: 'seek(t) paints frame t. Any frame, any order.' },
    { t: at(10.5), text: 'It renders, then studies its own frames.' },
    { t: at(18.5), text: 'Every format from one timeline.' },
  ],
  captionCps: 34,

  // CRITIC: the contact sheet of this very film
  tiles: { count: 12, start: at(10.5), gap: beat / 4 },
  defect: { tile: 6, press: at(14), fixed: at(16) },
  // the critic's reading beam: [time, tile position] (linear), it stops on the defect
  scan: [[at(13.3), 0], [at(14), 6.5], [at(16), 6.5], [at(17.4), 12]],

  // FORMATS: one frame splits into three aspect ratios and merges back
  formatsSplit: at(19),
  formatsMerge: at(25.5),

  // CLOSE
  cta: { text: '/motion-reel your-product.com', at: at(26.8), cps: 22 },
  sign: { text: 'a Claude Code skill', at: at(28.4) },

  get cues() {
    return [
      { t: at(0.5), label: 'dot' },
      ...this.headline.at.map((t, i) => ({ t, label: `line ${i + 1}` })),
      { t: at(4.4), label: 'scrubber' },
      ...this.scrub.map(([t]) => ({ t, label: 'drag' })),
      { t: at(10), label: 'sheet' },
      { t: this.defect.press, label: 'press' },
      { t: this.defect.fixed, label: 'fixed' },
      { t: at(18), label: 'frame' },
      { t: this.formatsSplit, label: 'split' },
      { t: at(26), label: 'cta' },
      { t: at(31.1), label: 'out' },
    ];
  },
};
