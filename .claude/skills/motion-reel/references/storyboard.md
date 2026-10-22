# Storyboards as state lists

"Zoom in, morph, add particles" is a list of activity. A storyboard says what the
viewer knows at each second. Write `shotlist.md` as a list of states, then turn
it into `timeline.mjs`.

## The default arc (16 s)

| time | beat | job |
|---|---|---|
| 00–02 s | HOOK | one image that earns attention — no logo-on-gradient |
| 02–05 s | PROBLEM | the friction, shown on screen, not narrated |
| 05–09 s | REVEAL | the product enters through a real interaction |
| 09–13 s | PROOF | one real screen or sourced number backs the claim |
| 13–16 s | CLOSE | a clean final state and a readable CTA |

Scale it to the duration; keep the order. A showreel swaps PROBLEM/PROOF for
range (three or four contrasting moves) but keeps HOOK and CLOSE.

## Every beat: entry state, exit state, reason

For each row write what is on screen when the beat starts, what is on screen when
it ends, and what the viewer now knows that they didn't. If you can't say why shot
four exists, cut shot four. Entry and exit states make transitions obvious: the
exit of one beat is the entry of the next, so there is nothing to "transition".

## One shape that never cuts

The most-shared structure of the Opus launch wave: a single container morphs size,
radius and color from state to state, a cursor drives every change with real
clicks, and the last frame matches the first so the clip loops:

```
logo → CTA button → email field (typed) → loader → success check → dashboard
     → chart draws itself → tooltip → ⌘K palette → toast → logo
```

In code that is one `morph(t, steps, states, feels)` call (see composition.md):
`states` holds each state's geometry and color, `steps` the times. Cuts are rare;
the viewer's eye never has to find the subject again.

Choreograph the path, not just the end states. A shape that travels across the
frame sweeps through whatever is there — split the move (drop, then stretch) or
time it after the text has left.

## A fake UI is a film set

When the story needs a place, build it: a video editor with a timeline, a phone, a
desktop with windows. Every element of a set has a known state at every second,
which is exactly what seek(t) wants. It is a set, not a product — when the film is
about a real product, its screens must be the real ones.

## Pace

- a new state every 0.5–2 s, something new on screen every 2–4 s, nothing static
  for 3 s unless it is a deliberate hold for reading
- holds for text: about 0.4 s plus 0.06 s per word, after the text has landed
- put state changes on beats (`beat = 60 / bpm`), big moments on downbeats
- one idea per shot; if two things move, one of them should be the camera

## Per format

Every format comes from the same timeline; layouts differ, timing doesn't.

- 16x9: more spatial context; two columns work; type can be smaller
- 9x16: one column, bigger type, fewer elements; keep text out of the platform
  zones (top 220 px, bottom 420 px, right 140 px around y 920–1500)
- 1x1: tighter holds, centered compositions are acceptable here

## From shot list to timeline.mjs

```js
const bpm = 120, beat = 60 / bpm, at = (n) => n * beat;
export default {
  duration: 16, fps: 60, formats: ['16x9', '9x16'], bpm,
  shots: [{ name: 'HOOK', start: 0, end: 2 }, /* … */],
  steps: [[0, 'hidden'], [at(0.5), 'dot'], [at(4), 'button'], /* … */],
  clicks: [at(9), at(17)],
  get cues() { return [/* every moment sound must hit: { t, label } */]; },
};
```

Shots label the review sheets; cues are checked for sound by `review.mjs`.
