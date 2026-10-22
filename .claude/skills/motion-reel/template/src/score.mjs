// score.mjs — the soundtrack for {{TITLE}}, synthesized on the picture's clock.
//
// Called by the renderer (Node) and the preview player (browser) with
// { duration, sampleRate }; returns the mix from master(). Read the same
// timeline as index.html so every hit lands on its frame. To use a supplied
// track instead, set audio.track in index.html and keep only the SFX here.

import { createMix, pad, chordHz, pattern, click, whoosh, master } from '/_studio/synth.mjs';
import tl from './timeline.mjs';

export default function score({ duration, sampleRate }) {
  const mix = createMix(duration, sampleRate);
  const bar = (60 / tl.bpm) * 4;

  // bed and pulse — replace with the film's own music
  pad(mix, 0, { notes: chordHz('D3', 'min7'), dur: duration - 1, gain: -24 });
  pattern(mix, { bpm: tl.bpm, bars: Math.floor(duration / bar), tracks: { kick: 'x.......x.......', hat: '....x.......x...' }, gains: { kick: -8, hat: -16 } });

  // every press gets a click; every other state change gets a move (one sound per event)
  for (const t of tl.clicks) click(mix, t, { gain: -4 });
  for (const [t] of tl.steps.slice(1)) if (!tl.clicks.some((c) => Math.abs(c - t) < 0.2)) whoosh(mix, t, { dur: 0.45, gain: -14 });

  return master(mix);
}
