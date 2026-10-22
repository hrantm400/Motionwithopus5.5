# Sound

Sound runs on the same clock as the picture. People assume the audio in the
code-rendered reels was added in post; in the good ones it came straight from
code, every hit locked to the frame that caused it.

## score.mjs

```js
import { createMix, pad, chordHz, pattern, click, whoosh, keyTap, master } from '/_studio/synth.mjs';
import { typeTimes } from '/_studio/motion.mjs';
import tl from './timeline.mjs';

export default function score({ duration, sampleRate }) {
  const mix = createMix(duration, sampleRate);
  pad(mix, 0, { notes: chordHz('D3', 'min7'), dur: duration - 1, gain: -24 });
  pattern(mix, { bpm: tl.bpm, bars: 4, tracks: { kick: 'x...x...x...x...', hat: '..x...x...x...x.' } });
  for (const t of tl.clicks) click(mix, t);
  for (const t of typeTimes(tl.cta.text, tl.cta.at, tl.cta.cps, 5)) keyTap(mix, t);
  return master(mix);
}
```

The renderer calls it in Node; the preview player calls it in the browser. Same
input, same samples — nothing random, nothing streamed. Declare it in
`defineFilm({ audio: { score: './score.mjs' } })`.

## The synth (`/_studio/synth.mjs`)

Every instrument is `fn(mix, t, options)`; gains in dB, pan −1…1, `verb` = reverb send.

| group | functions |
|---|---|
| drums | `kick` `snare` `clap` `hat({ open })` · `pattern(mix, { bpm, start, bars, tracks, gains, until })` returns the hit times · `patternTimes()` gives them without sound (for the picture) |
| interface | `click` (a press) · `keyTap` (typing) · `pop` (something appears) · `chime({ notes })` (success) |
| transitions | `whoosh(mix, at, { dur })` — **crests at `at`**: put `at` on the cut or the fastest frame · `riser(mix, at, { dur })` — **ends at `at`**: the downbeat it builds into · `impact` (reveals, logo hits) |
| tonal | `tone({ note, dur, type, cutoff, filterEnv, glide, unison, detune })` for bass, plucks, leads · `pad({ notes, dur })` for beds · `noteHz('A3')`, `chordHz('D3', 'min7')` |
| finish | `master(mix, { verb, drive })` — reverb, soft limiter, end fade; return its result |

## Sound design rules

- **One sound per event.** Every state change in `timeline.mjs` gets exactly one
  sound — a click if a cursor pressed, a whoosh if the shape moved, a pop if
  something appeared. Two sounds on one event read as mud; none reads as broken.
- **Hierarchy.** Music bed −20…−27 dB under the SFX; SFX that matter (the CTA, the
  reveal) loudest. Typing and ticks quiet (−20…−30 dB).
- **Build and release.** Add layers shot by shot (pad → kick → hats → claps), drop
  them for the close so the CTA has air, end in silence if the film loops.
- **Leave room before the big hit.** A beat of less is what makes the impact land.
- **Musical grid.** Keep the picture's changes on the beat grid and the sound sits
  in the music for free.

## With a supplied track

```
npm run beats -- films/<slug>/assets/audio/song.wav --out films/<slug>/src/beats.json
```

`beats.json` has `bpm`, `beats` (state changes go here), `downbeats` (big moments;
a 4/4 heuristic — check against the energy curve), `hits` (strong onsets: clicks,
whooshes, cuts) and `energy` ([t, dB] every 0.25 s: find the build, the drop, the
outro). Import it in `timeline.mjs`:

```js
import beats from './beats.json' with { type: 'json' };
```

Then `defineFilm({ audio: { track: '../assets/audio/song.wav', trackGain: -2, trackOffset: 0, score: './score.mjs' } })`
— the score keeps only SFX, the track carries the music; the renderer mixes both.
Pick a section of the track with `trackOffset` (seconds into the song at film t=0).
Use `--bpm 100:200` if a fast track is read half-time.

## Loudness

The renderer mixes the score and the track, then normalizes to −14 LUFS integrated
with a −2.5 dBTP ceiling (two-pass loudnorm). AAC adds about 1 dB of true peak on
transients, so the renderer encodes the mix once, measures it, and pulls the whole
mix down if the encoded peak is still above −1.2 dBTP. Override the loudness with
`--lufs` or `audio.lufs`. `review.mjs` measures the export again (ebur128) and
flags anything off by more than 1.5 LU or peaking above −1 dBTP.

## Listening without ears

You can't hear the mix. The review gives you two instruments instead:

- `signals.png` — the audio envelope on the same time axis as shots, cues and
  motion energy, with detected onsets marked. The blindfold test: if the audio row
  has no shape of its own (no build, no hits, no release), the sound design is
  unfinished.
- the sync count in `report.md` — how many cues and cuts have a transient or a
  swell crest within 80 ms, and which ones don't. A cue without sound is either a
  missing SFX or one buried under something louder at the same moment.
