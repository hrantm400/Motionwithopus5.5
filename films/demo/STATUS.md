# Status — seek(t), the motion-reel demo

Created 2026-10-22 · 16 s · 16x9, 9x16 · 60 fps · loops

| gate | what | state | notes |
|---|---|---|---|
| 1 | brief + real assets approved | ☑ | no product: the film is about the pipeline itself; fonts are OFL/Apache |
| 2 | style_guide.md + shotlist.md approved | ☑ | Swiss editorial, one accent, one shape that never cuts |
| 3 | a still for every shot, critiqued | ☑ | 3 rounds of stills: leaks, CTA alignment, vertical overflow |
| 4 | animatic 960×540, placeholder audio | ☑ | skipped as a separate file: full renders were cheap (≈45 s per format) |
| 5 | full pass, polish, sound — every score ≥ 8 | ☑ | see review rounds below |
| 6 | all formats, loop check, poster, README | ☑ | out/demo-16x9.mp4, out/demo-9x16.mp4, posters; copies in docs/ |

## Decisions

- Geometry glides on springs, color cuts on the beat (`{ freq: 60, damping: 1 }`): tweening ink into the accent went through brown.
- The dot drops beside the headline before stretching into the scrubber, so the morph never crosses text.
- Vertical keeps all content left of the platform button zone (x < 920) and out of the top 220 / bottom 420 px.
- Captions are mono and typed; key taps in the score come from the same `typeTimes()`.

## Blockers / questions for the user

- none

## Review rounds

| round | format | lowest score | worst defect fixed |
|---|---|---|---|
| stills ×3 | both | — | elements from earlier shots leaking into later ones (`visibility` → `display:none`); CTA text off-center; vertical contact sheet overflowing its panel; caption/label collisions |
| r01–r02 | both | — | determinism "FAIL" on 2 px of compositor noise → review now measures the size of the difference |
| r03 | 16x9 | 6 motion | the morph swept through the leaving headline; ink→orange tween went muddy; dead stretch 6.7–9 s; format frames too small |
| r04–r05 | both | 6 motion | readout hidden by the cursor; black frames at 9.0 and 13.0; vertical content under the button zone |
| r06–r07 | both | 7 motion | one black frame at exactly 13.000 (visibility tied to the state name) |
| r08–r11 | both | 7 motion | vertical: contact sheet dimmed to grey and left an empty black panel → crossfade |
| r12–r13 | both | 7 phone (16x9) | format labels and the sign line too small at 360 px |
| r14–r15 | both | 8 | final — the review images, reports and critiques are copied to docs/demo-review/ (reviews/ itself is git-ignored) |
