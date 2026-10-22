# Style guide — seek(t)

## Palette (hex, with roles)

| role | hex | notes |
|---|---|---|
| background | `#F1EEE7` | warm paper, never pure white |
| ink (text, panels) | `#111111` | headline, captions, scrubber, contact sheet |
| accent (one) | `#FF4F1A` | used for: the dot, the playhead, the caret, the flagged tile, the CTA |
| grid | `#111111` at 7% | 2 px hairlines on the column grid |

## Type

- display: Inter Display Bold · tracking −0.045em · sentence case · line-height 0.98
- UI: JetBrains Mono Regular/Bold for captions, readouts, the command
- scale: wide headline 168 px, captions 48 px · vertical headline 138 px, captions 42 px
- numbers: mono, zero-padded (`seek(06.60)`)

## Motion

| object class | feel | notes |
|---|---|---|
| the dot's first entrance | feel.headline | pops with a small overshoot |
| the one shape (all other morphs) | feel.panel | settles in ~0.6 s |
| headline lines | feel.headline | land hard behind a mask, leave together |
| tiles, ring | feel.ui | snap, no visible overshoot |
| playhead drags | freq 2.6, damping 0.92 | a hand dragging |
| cursor | feel.cursor | arcs between targets |
| the critic's beam | linear | machines move linearly |
| color | cut (freq 60) | geometry glides, color cuts on the beat — ink→orange tweens turn to mud |

## Pace and transitions

- 120 bpm: every change on the beat grid (0.5 s), big ones on downbeats (every 2 s)
- shots: 2 / 3 / 4 / 4 / 3 s — one continuous shape, no cuts
- transitions: morphs of the one shape; text enters behind masks
- something new on screen every 0.5–2 s

## Texture

- none: flat paper, no grain, no shadows, 2–3 px ink borders, radius from the shape's state

## Banned here

- centered title on a gradient · everything fading in · corner labels · glow on UI
- tweening ink into the accent (use a cut)
- anything under the vertical platform zones (top 220 px, bottom 420 px, right 140 px)

## Taken from the reference — grammar only

- Swiss editorial: flush-left type on a visible column grid, one accent, generous margins
