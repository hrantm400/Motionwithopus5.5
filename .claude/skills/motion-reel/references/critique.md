# The critic

Opus reads images, so it can inspect what it just rendered. That one habit is
what the clips that blew up had in common — and it is the step people skip,
because the first render feels like progress. Don't watch a full export ten times;
let `review.mjs` build the evidence, then judge it.

## The review pack, image by image

`npm run review -- <slug> --format <f>` reads the exported MP4 (what
ships, encoding included) and writes `reviews/rNN-<format>/`:

| file | what it shows | look for |
|---|---|---|
| `contact.png` | a frame every 0.5 s, 6 across, with time and shot | composition per beat, hierarchy, variety, dead stretches, the first 2 s |
| `strip.png` | 12 consecutive frames around the fastest move | elements sliding where they should ease, overshoot that looks wrong, shapes crossing text, one-frame flashes, muddy color tweens |
| `phone.png` | one frame per shot at 360 px wide — actual size | can you read every word? on vertical: is anything under the red platform zones? |
| `seam.png` | last 6 frames, then the first 6 | a jump or stutter at the loop point |
| `signals.png` | shots, motion energy, audio envelope + onsets, cues on one clock | flat motion = static stretch; cues without onsets; audio with no shape |
| `loop.mp4` | the clip twice back to back | (for a human; the seam image is your version) |
| `report.md` | measurements and automatic flags | loudness, true peak, sync count, determinism, contract lint |

Automatic flags are leads: `static` (no visible change for ≥ 3 s), `silence`
(≥ 1 s), `sync` (a cue or cut with no sound within 80 ms), `loudness`, `peak`,
`loop` (seam jump much larger than typical motion), `determinism`. Decide each
one: an intentional hold for reading is fine, a still nobody chose is a dead beat.

## The critique task

Write it into `critique.md` in the review folder (the template is there):

```
Judge only the rendered frames, ignore what you meant to make.
Score 1–10: hook in 2 s, phone readability, motion, variety, sound sync, brand accuracy.
List the 3 worst defects with timestamp, evidence and a local fix.
Patch those seconds, re-render them, repeat until every score is 8+.
```

Evidence means a file and a timestamp: "strip.png f128–f133: the pill crosses
'of time.' while it is still leaving". A local fix names the seconds and the
property: "split the 2.0 s move into drop (2.0) then stretch (2.2)".

## Rubric anchors

| criterion | 4 | 8 | 10 |
|---|---|---|---|
| hook | logo or title fades in on a gradient | a decisive image in the first second, something lands by 2 s | you'd stop scrolling |
| phone readability | words unreadable at 360 px, text under platform UI | every word readable at 360 px, nothing in the zones | the vertical cut feels designed for the phone |
| motion | linear slides, uniform easing, things snap | springs per object class, no slides, holds that read | every move has weight and a reason |
| variety | one trick repeated, or 3 s of nothing | something new every 2–4 s, rhythm varies | the pace itself tells the story |
| sound sync | music laid underneath, hits miss | every state change has its sound on the frame | you could follow the film blindfolded |
| brand accuracy | invented UI, wrong colors, system fonts | real assets, palette and type from the guide | indistinguishable from the brand's own work |

## What to hunt for

- overlapping text; text crossed by a moving shape
- elements sliding at constant speed where they should ease; everything
  overshooting the same way
- corner labels, centered titles on gradients, fade-ins on everything, glow on UI
- blurry type (scaled raster, text on a scaled layer)
- a dead beat: nothing new for 3+ s that nobody chose
- a stutter or jump at the loop point; one black or empty frame between states
- muddy color in a tween between ink and a saturated accent
- text in the vertical platform zones; type too small at 360 px
- a cue with no sound, two sounds on one event, a mix with no build or release
- anything that looks like a product screen but isn't one
- an empty first frame: on a feed it is the thumbnail and the first impression
- a poster caught mid-transition (a wipe half done, a fade at 40 %)

## The loop

1. review → read every image and report.md
2. fill critique.md: six scores, three worst defects
3. patch those seconds; check with `render.mjs --stills 2.0,2.1,2.2` or `--from 1.5 --to 3`
4. full render of the affected formats, review again (a new round folder)
5. record the round in STATUS.md: lowest score, worst defect fixed

Before signing off, look at a few frames at full size, the poster among them:
`npm run render -- <slug> --stills 8.8,15.4,18.9 --format all` writes full-size
PNGs next to its sheet (open the PNGs, not only the sheet), and the posters are
full size in `out/`. A 320 px contact sheet hides a column cut off by a half-finished wipe, a cursor resting on the
label it clicks, a beam running over a card's title.

Stop at 8+ on every criterion in every format. After six rounds without getting
there, deliver the best version and write what remains in STATUS.md, plainly.
