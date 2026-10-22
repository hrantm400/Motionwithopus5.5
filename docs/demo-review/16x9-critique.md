# Critique r14 · demo · 16x9

Judge only the rendered frames and the measurements in report.md. Ignore what you meant to make.

| criterion | score 1–10 | evidence (timestamp + what you see) |
|---|---|---|
| hook — the first 2 s earn attention | 8 | contact 00:00.50–00:01.50: the dot pops at 0.25 s, the three lines land on 0.5 / 1.0 / 1.5 s. Frame 0 is bare paper (needed for the loop); the poster at 06.90 is the thumbnail |
| phone readability — phone.png at 360 px | 8 | headline, captions, the seek() readout, format labels and the CTA all read at 360 px; tile timestamps are texture, not information |
| motion — mass, easing, nothing slides or snaps wrong (strip.png) | 8 | strip around 05.10: the scrubber grows into the sheet on panel springs, no linear slides; the dot drops beside the text before stretching; color cuts on beats, no mud |
| variety — something new every 2–4 s, no dead beats | 8 | a new state every 0.5–2 s, no static flags; the beam keeps CRITIC alive; the close holds ~1 s on the finished command on purpose |
| sound sync — hits on state changes, audio has its own shape | 9 | 18/18 cues and cuts within 80 ms (median 2 ms); the score builds from 2 s, drops out for the CTA at 13 s and ends in silence for the loop |
| brand accuracy — real assets, colors, type, nothing invented | 9 | palette, type and grid per style_guide.md; every "screen" is the film's own state drawn small; no product UI invented |

## Three worst defects

1. **[00:00.00]** first frame is bare paper — evidence: contact 00:00.00 — kept for the loop seam (seam.png jump 0.00); for a non-looping cut start at 0.25 s with the dot.
2. **[00:05.25–00:06.60]** tile timestamps (18 px) vanish on a phone — evidence: phone.png 07.80 — acceptable as texture; enlarge if this 16:9 cut is meant for mobile feeds.
3. **[00:13.00]** the cut to orange on the impact is abrupt by design — evidence: strip.png f780–f781 — a left-to-right wipe would be softer; kept, it lands on the downbeat.

## Fix log

- r03: split the dot→scrubber move (drop, then stretch) so it no longer crosses the headline; color now cuts instead of tweening through brown
- r04: readout moved above the playhead (the cursor hid it); vertical content moved out of the button zone
- r06: one black frame at 13.000 removed (inner frame visibility tied to time, not the state name)
- r08–r12: contact-sheet → frame crossfade; format labels 24→32 px, sign 36→46 px for phone readability
