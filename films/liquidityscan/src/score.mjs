// score.mjs — the LiquidityScan promo soundtrack, synthesized on the picture's clock.
//
// 120 bpm in A minor. The hook is tense and unresolved (a filtered ostinato and
// a pop for every ping), the freeze-cut at 4 s is a hit and a breath of
// silence, then the groove builds chapter by chapter and drops out for the
// end card. Every event in timeline.mjs gets exactly one sound.

import {
  createMix, pad, tone, chordHz, pattern, kick, clap, click, keyTap, pop, chime, whoosh, riser, impact, master, noteHz,
} from '/_studio/synth.mjs';
import { typeTimes } from '/_studio/motion.mjs';
import tl from './timeline.mjs';

export default function score({ duration, sampleRate }) {
  const mix = createMix(duration, sampleRate);
  const b = tl.beat;

  // ── HOOK: tension without a beat ──────────────────────────────────────────
  const ost = ['A2', 'A2', 'A3', 'A2', 'G2', 'A2', 'C3', 'A2'];
  for (let i = 0; i < 16; i++) {
    const t = i * (b / 2);
    tone(mix, t, { note: ost[i % 8], dur: 0.18, type: 'saw', gain: -21, cutoff: 280 + 1100 * (t / tl.hook.freeze), filterEnv: 2.5, filterDecay: 0.08, a: 0.003, d: 0.1, s: 0.3, r: 0.08 });
  }
  tl.hook.pings.forEach((t, k) => pop(mix, t, { gain: -23 + (k / tl.hook.pings.length) * 4, pitch: 1.1 + ((k * 7) % 5) * 0.14, pan: (k % 2 ? 1 : -1) * (0.25 + (k % 3) * 0.2), verb: 0.05 }));
  tl.hook.lines.forEach((t) => kick(mix, t, { gain: -14, decay: 0.28, pitch: 1.15 }));
  riser(mix, tl.hook.freeze, { dur: 2.2, gain: -17 });
  for (const t of typeTimes(tl.hook.kicker, tl.hook.kickerAt, 46, 70)) keyTap(mix, t, { gain: -28 });

  // ── TURN: freeze-cut, a breath, the brand ─────────────────────────────────
  impact(mix, tl.turn.collapse, { gain: -5, size: 1.1 });
  whoosh(mix, tl.turn.collapse + 0.55, { dur: 0.5, gain: -19, from: 4000, to: 300, pan: [0.5, -0.5] }); // the wall collapses into the mark
  tl.turn.lines.forEach((t) => click(mix, t, { gain: -17, pitch: 0.8 }));
  chime(mix, tl.turn.brand, { notes: ['A5', 'E6'], gain: -16, decay: 1.2 });
  pad(mix, tl.turn.collapse + 0.5, { notes: chordHz('A2', 'min7'), dur: 1.4, gain: -24, a: 0.25, r: 0.8, cutoff: 900 });

  // ── the groove: A minor, i – VI – III – VII from 6 s ──────────────────────
  const prog = [[6, 'A2', 'min7'], [8, 'F2', 'maj7'], [10, 'C3', 'maj7'], [12, 'G2', '7'], [14, 'A2', 'min7'], [16, 'F2', 'maj7']];
  prog.forEach(([t, root, q]) => pad(mix, t, { notes: chordHz(root, q), dur: 1.85, gain: -26, a: 0.15, r: 0.7, cutoff: 1500 }));
  for (const [t0, root] of prog) {
    for (const k of [0, 2]) tone(mix, t0 + k * b * 2, { note: root, dur: 0.45, type: 'saw', gain: -18, cutoff: 240, filterEnv: 3, filterDecay: 0.1, a: 0.004, d: 0.18, s: 0.5, r: 0.12 });
  }
  pattern(mix, { bpm: tl.bpm, start: 6, bars: 2, tracks: { kick: 'x...x...x...x...', hat: '..x...x...x...x.' }, gains: { kick: -8, hat: -19 } });
  pattern(mix, { bpm: tl.bpm, start: 10, bars: 3, tracks: { kick: 'x...x...x...x...', hat: '..x...x...x.x.x.', clap: '....x.......x...' }, gains: { kick: -7, hat: -18, clap: -15 }, until: tl.close.end });
  pattern(mix, { bpm: tl.bpm, start: 16, bars: 1, tracks: { hat: 'x.x.x.x.x.x.x.x.' }, gains: { hat: -20 }, until: tl.close.end });

  // ── COVER: stats and cards ────────────────────────────────────────────────
  for (const t of typeTimes(tl.cover.kicker, tl.cover.kickerAt, 46, 71)) keyTap(mix, t, { gain: -28 });
  tl.cover.stats.forEach((s, i) => tone(mix, s.t, { note: ['E5', 'A5', 'C6'][i], dur: 0.12, type: 'tri', gain: -19, cutoff: 5000, a: 0.002, d: 0.08, s: 0.3, r: 0.25, verb: 0.2 }));
  tl.cover.cards.forEach((t, i) => {
    whoosh(mix, t, { dur: 0.35, gain: -24, from: 600, to: 4800 }); // the card lands
    keyTap(mix, t + 0.12, { gain: -20, pan: -0.4 + i * 0.25 }); // the beam starts reading
  });

  // ── CONFIRM: rows on beats, FIRE on the downbeat ──────────────────────────
  for (const t of typeTimes(tl.confirm.kicker, tl.confirm.kickerAt, 46, 72)) keyTap(mix, t, { gain: -28 });
  whoosh(mix, tl.confirm.panelIn, { dur: 0.5, gain: -20 });
  tl.confirm.rows.forEach((t, i) => {
    click(mix, t, { gain: -12, pitch: 1 + i * 0.12 });
    tone(mix, t + 0.01, { note: ['A4', 'C5', 'E5'][i], dur: 0.2, type: 'tri', gain: -17, cutoff: 4000, a: 0.002, d: 0.1, s: 0.4, r: 0.3, verb: 0.25 });
  });
  impact(mix, tl.confirm.fire, { gain: -9, size: 0.8 });
  chime(mix, tl.confirm.fire, { notes: ['A5', 'C6', 'E6'], gain: -14, decay: 1.4, spread: 0.05 });
  pop(mix, tl.confirm.footer, { gain: -20, pitch: 1.3 });

  // ── DECIDE ────────────────────────────────────────────────────────────────
  for (const t of typeTimes(tl.decide.kicker, tl.decide.kickerAt, 46, 73)) keyTap(mix, t, { gain: -28 });
  whoosh(mix, tl.decide.cardIn, { dur: 0.55, gain: -15, pan: [0.6, -0.1] });

  // ── CLOSE: three words, then the end card ─────────────────────────────────
  tl.close.words.forEach(([, t], i) => {
    kick(mix, t, { gain: -6, decay: 0.4 });
    clap(mix, t, { gain: -12 });
    tone(mix, t, { note: ['A3', 'C4', 'E4'][i], dur: 0.35, type: 'saw', unison: 3, detune: 12, gain: -17, cutoff: 1800, filterEnv: 1.5, a: 0.003, d: 0.15, s: 0.5, r: 0.3, verb: 0.25 });
  });
  riser(mix, tl.close.end, { dur: 1.2, gain: -22 });
  whoosh(mix, tl.close.end + 0.07, { dur: 0.45, gain: -19, from: 3500, to: 500, pan: [0.6, -0.6] }); // the push into the end card
  impact(mix, tl.close.end, { gain: -8, size: 0.9 });
  chime(mix, tl.close.end + 0.02, { notes: ['E5', 'A5', 'C6', 'E6'], gain: -15, decay: 1.8, spread: 0.06 });
  pad(mix, tl.close.end, { notes: chordHz('A2', 'min7').concat([noteHz('E4')]), dur: duration - tl.close.end - 1, gain: -23, a: 0.4, r: 1.0, cutoff: 1200 });
  pop(mix, tl.close.cta, { gain: -16, pitch: 1.1 });
  click(mix, tl.close.press, { gain: -6 });
  chime(mix, tl.close.press + 0.03, { notes: ['A6'], gain: -20, decay: 0.9 });

  return master(mix, { verb: { size: 0.8, damp: 0.35 } });
}
