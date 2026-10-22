// score.mjs — the soundtrack of "seek(t)", synthesized on the picture's clock.
//
// 120 bpm, 8 bars in D minor. The music builds shot by shot (pad → kick →
// hats → claps), drops out for the close, and ends in silence so the loop
// seam is clean. Every event in timeline.mjs gets exactly one sound.

import {
  createMix, pad, tone, chordHz, pattern, kick, click, keyTap, pop, whoosh, riser, impact, chime, master,
} from '/_studio/synth.mjs';
import { typeTimes } from '/_studio/motion.mjs';
import tl from './timeline.mjs';

export default function score({ duration, sampleRate }) {
  const mix = createMix(duration, sampleRate);
  const bar = tl.beat * 4;

  // ── music ────────────────────────────────────────────────────────────────
  // i – VI – III – VII, two bars each, then home
  const prog = [['D3', 'min7'], ['Bb2', 'maj7'], ['F3', 'maj7'], ['C3', 'add9']];
  prog.forEach(([root, q], i) => pad(mix, i * 2 * bar, { notes: chordHz(root, q), dur: 2 * bar - 0.2, gain: -27, a: 0.5, r: 1.4, cutoff: 1100 + i * 250 }));
  pad(mix, 13, { notes: chordHz('D3', 'min7'), dur: 1.9, gain: -26, a: 0.3, r: 1.0, cutoff: 1500 });

  const roots = ['D2', 'D2', 'Bb1', 'Bb1', 'F2', 'F2', 'C2', 'C2'];
  for (let b = 1; b <= 6; b++) {
    for (const beatInBar of [0, 2]) {
      const t = b * bar + beatInBar * tl.beat;
      if (t >= 13) break;
      tone(mix, t, { note: roots[b], dur: 0.7, type: 'saw', gain: -19, cutoff: 260, filterEnv: 3, filterDecay: 0.12, a: 0.004, d: 0.2, s: 0.5, r: 0.15 });
    }
  }

  // drums build with the story and stop for the close
  pattern(mix, { bpm: tl.bpm, start: 2, bars: 2, tracks: { kick: 'x...x...x...x...' }, gains: { kick: -9 }, until: 5 });
  pattern(mix, { bpm: tl.bpm, start: 5, bars: 4, tracks: { kick: 'x...x...x...x...', hat: '..x...x...x...x.' }, gains: { kick: -8, hat: -19 }, until: 9 });
  pattern(mix, { bpm: tl.bpm, start: 9, bars: 2, tracks: { kick: 'x...x...x...x...', hat: '..x...x...x.x.x.', clap: '....x.......x...' }, gains: { kick: -7, hat: -18, clap: -15 }, until: 12.75 });
  riser(mix, 13, { dur: 1.6, gain: -21 });
  impact(mix, 13, { gain: -12, size: 0.8 });

  // ── sound design: one sound per event ────────────────────────────────────
  // the grid draws in and out like a ruler
  for (let i = 0; i <= 12; i++) keyTap(mix, tl.grid.in + i * 0.025 + 0.05, { gain: -30, pan: -0.6 + i * 0.1 });
  for (let i = 0; i <= 12; i++) keyTap(mix, tl.grid.out + i * 0.02 + 0.25, { gain: -32, pan: -0.6 + i * 0.1 });

  pop(mix, tl.steps[1][0], { gain: -10, pitch: 1.2 }); // the dot appears
  tl.headline.at.forEach((t, i) => { kick(mix, t, { gain: -12, decay: 0.3, pitch: 1.1 }); click(mix, t, { gain: -18, pitch: 0.9 + i * 0.15 }); });

  whoosh(mix, tl.steps[3][0], { dur: 0.55, gain: -16 }); // the dot drops and stretches into the scrubber
  tl.scrub.forEach(([t], i) => click(mix, t, { gain: -10, pitch: 1 + i * 0.08, pan: -0.2 + i * 0.15 }));

  tl.captions.forEach((c, i) => {
    for (const t of typeTimes(c.text, c.t, tl.captionCps, 11 + i)) keyTap(mix, t, { gain: -25 });
  });

  whoosh(mix, tl.steps[4][0], { dur: 0.6, gain: -15, from: 200, to: 3800 }); // scrubber → sheet
  for (let i = 0; i < tl.tiles.count; i++) pop(mix, tl.tiles.start + i * tl.tiles.gap, { gain: -22, pitch: 0.9 + i * 0.05, pan: -0.5 + (i % 6) * 0.2 });
  // the beam ticks as it enters each tile
  for (let i = 1; i < tl.tiles.count; i++) {
    for (let k = 1; k < tl.scan.length; k++) {
      const [t0, v0] = tl.scan[k - 1], [t1, v1] = tl.scan[k];
      if (v1 > v0 && i > v0 && i <= v1) keyTap(mix, t0 + ((i - v0) / (v1 - v0)) * (t1 - t0), { gain: -27, pan: -0.5 + (i % 6) * 0.2 });
    }
  }
  click(mix, tl.defect.press, { gain: -9 });
  tone(mix, tl.defect.press + 0.02, { note: 'A3', dur: 0.12, type: 'square', gain: -24, cutoff: 1400, a: 0.002, d: 0.05, s: 0.4, r: 0.05 });
  chime(mix, tl.defect.fixed, { notes: ['A5', 'E6'], gain: -17, decay: 1.1 });

  whoosh(mix, tl.steps[5][0], { dur: 0.6, gain: -15 }); // sheet → frame
  whoosh(mix, tl.formatsSplit, { dur: 0.45, gain: -18, pan: [0.6, -0.6] });
  pop(mix, tl.formatsSplit + 0.02, { gain: -16, pitch: 0.8 });
  whoosh(mix, tl.formatsMerge, { dur: 0.45, gain: -18, pan: [-0.6, 0.6] });

  for (const t of typeTimes(tl.cta.text, tl.cta.at, tl.cta.cps, 5)) keyTap(mix, t, { gain: -21 });
  chime(mix, tl.sign.at, { notes: ['D6', 'A6'], gain: -18, decay: 1.4 });

  whoosh(mix, tl.steps[7][0], { dur: 0.4, gain: -19 }); // cta → dot
  pop(mix, tl.steps[8][0], { gain: -14, pitch: 0.7 }); // the dot leaves

  return master(mix, { verb: { size: 0.78, damp: 0.4 } });
}
