// timeline.mjs — the one clock for the LiquidityScan promo.
//
// index.html (picture) and score.mjs (sound) both import this file, so every
// state change and every hit land on the same frame. 120 bpm: beat 0.5 s,
// bar 2 s, 10 bars. Plain data and arithmetic only.

const bpm = 120;
const beat = 60 / bpm;
const at = (n) => n * beat; // beat n

// Pings in the hook arrive faster and faster: 34 of them between 0.6 s and 3.9 s.
// Deterministic (no randomness): the k-th ping time follows a power curve.
const PING_COUNT = 34;
const pings = Array.from({ length: PING_COUNT }, (_, k) => {
  const u = k / (PING_COUNT - 1);
  return Math.round((0.6 + 3.3 * u ** 0.62) * 1000) / 1000;
});

export default {
  duration: 20,
  fps: 60,
  formats: ['16x9', '9x16'],
  bpm,
  beat,

  shots: [
    { name: 'HOOK', start: 0, end: 4 },
    { name: 'TURN', start: 4, end: 6 },
    { name: 'COVER', start: 6, end: 10 },
    { name: 'CONFIRM', start: 10, end: 14 },
    { name: 'DECIDE', start: 14, end: 16 },
    { name: 'CLOSE', start: 16, end: 20 },
  ],

  hook: {
    kicker: 'THE STATUS QUO',
    kickerAt: at(1.6),
    lines: [at(2), at(3)], // "You can't watch" / "every chart." (vertical splits into 3)
    dimAt: at(1.8),
    pings,
    freeze: at(8),
  },

  turn: {
    collapse: at(8),
    lines: [at(8.5), at(9)], // "Stop babysitting" / "the charts."
    brand: at(10),
    out: at(11.3), // exits end on the downbeat: lines 0.28 s + stagger, brand 0.35 s
  },

  cover: {
    kicker: '01 · COVERAGE',
    kickerAt: at(12),
    // call and response: a stat on 6 / 7 / 8 (the first one is the drop), a card on the beat after each
    stats: [
      { t: at(12), big: '600+', small: 'pairs' },
      { t: at(14), big: '15', small: 'ICT / SMC engines' },
      { t: at(16), big: '24/7', small: 'on every closed candle' },
    ],
    cards: [at(13), at(15), at(17), at(18)], // each real engine card lands here; the beam reads it 0.12 s later
    carouselOut: at(19.4),
  },

  confirm: {
    kicker: '02 · CONFIRMATION',
    kickerAt: at(20),
    lines: [at(20.5), at(21)], // "Escalate only when" / "context agrees."
    panelIn: at(20),
    rows: [at(21), at(22), at(23)],
    fire: at(24),
    footer: at(25),
    out: at(27.3),
  },

  decide: {
    kicker: '03 · DECISION',
    kickerAt: at(28),
    lines: [at(28.5), at(29)], // "One thesis," / "not fifty pings."
    cardIn: at(28),
    out: at(31.3),
  },

  close: {
    words: [['Cover.', at(32)], ['Confirm.', at(33)], ['Decide.', at(34)]],
    end: at(35),
    tagline: at(35.5),
    cta: at(36),
    url: at(36.5),
    cursorIn: at(36),
    press: at(37.5),
  },

  get cues() {
    return [
      { t: this.hook.pings[0], label: 'ping' },
      ...this.hook.lines.map((t, i) => ({ t, label: `hook ${i + 1}` })),
      { t: this.hook.freeze, label: 'freeze' },
      { t: this.turn.brand, label: 'brand' },
      ...this.cover.stats.map((s) => ({ t: s.t, label: s.big })),
      ...this.confirm.rows.map((t, i) => ({ t, label: `row ${i + 1}` })),
      { t: this.confirm.fire, label: 'fire' },
      { t: this.decide.cardIn, label: 'war room' },
      ...this.close.words.map(([w, t]) => ({ t, label: w.replace('.', '') })),
      { t: this.close.end, label: 'end card' },
      { t: this.close.press, label: 'press' },
    ];
  },
};
