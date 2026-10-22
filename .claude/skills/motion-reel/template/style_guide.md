# Style guide — {{TITLE}}

Written from the reference and the brand, before any code. The composition
follows this file; when they disagree, fix one of them on purpose.

## Palette (hex, with roles)

| role | hex | notes |
|---|---|---|
| background | | |
| ink (text) | | |
| accent (one) | | used for: |
| support | | |

## Type

- display face: (file in assets/fonts/) · weight · tracking · case
- UI face: (file) · weight
- scale per format: wide headline px · vertical headline px · square headline px
- numbers: tabular? 

## Motion

| object class | feel (motion.mjs) | notes |
|---|---|---|
| small UI (buttons, chips, toggles) | feel.ui | snaps, no visible overshoot |
| panels, cards, the morphing container | feel.panel | settles with a hair of overshoot |
| camera | feel.camera | glides, almost invisible |
| headlines | feel.headline | land hard, hold long enough to read |
| cursor | feel.cursor | arcs, never travels on a ruler line |
| mascot / playful bits | feel.mascot | bounces on purpose — or not at all |

## Pace and transitions

- shot length: median s, range s (from the reference)
- transitions: morph / cut on beat / mask wipe / … (name them)
- camera: (static, slow push, parallax…)
- something new on screen every 2–4 s

## Texture

- grain / noise / paper / none:
- shadows, borders, radius:

## Banned here

- centered title on a gradient · everything fading in · corner labels · glow on UI
- (reference-specific clichés to avoid)

## Taken from the reference — grammar only

- (pace, type scale, transitions, camera) — never its subjects, logos or copy
