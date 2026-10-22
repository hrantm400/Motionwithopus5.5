# Critique r15 · demo · 9x16

Judge only the rendered frames and the measurements in report.md. Ignore what you meant to make.

| criterion | score 1–10 | evidence (timestamp + what you see) |
|---|---|---|
| hook — the first 2 s earn attention | 8 | contact 00:00.50–00:01.50: dot top-right, the headline lands line by line at 138 px; frame 0 bare paper for the loop |
| phone readability — phone.png at 360 px | 8 | captions 42 px and the 30 px badge read at 360 px; nothing important inside the red platform zones (phone.png) |
| motion — mass, easing, nothing slides or snaps wrong (strip.png) | 8 | strip around 09.05: the contact sheet crossfades into the 9:16 frame while the panel shrinks; no empty panel, no black frame |
| variety — something new every 2–4 s, no dead beats | 8 | new state every 0.5–2 s, no static flags |
| sound sync — hits on state changes, audio has its own shape | 9 | 16/16 cues and cuts within 80 ms (median 2 ms); same score as 16:9 |
| brand accuracy — real assets, colors, type, nothing invented | 9 | same palette and type; layout redesigned for vertical, not cropped |

## Three worst defects

1. **[00:00.00]** bare-paper first frame — as in 16:9; the poster at 06.90 serves as the cover.
2. **[00:05.25–00:08.80]** the 4×3 contact sheet tiles are small at 360 px (≈60 px wide each) — they read as "a grid of this film's frames", which is the point; a 3×4 grid would be bigger but taller than the safe area allows.
3. **[00:09.00–00:13.00]** the 16:9 and 1:1 frames below the main one are small on a phone — evidence: phone.png 11.80 — acceptable, the labels carry the idea.

## Fix log

- stills: tiles sized to fit both ways (they overflowed the panel); caption and labels moved apart
- r05: panel and scrubber pulled left of the button zone (x < 920); CTA moved above y 920; badge 24→30 px
- r09–r13: crossfade from the contact sheet into the format frame instead of dimming to grey
