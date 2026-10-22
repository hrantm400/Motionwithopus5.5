# Status — LiquidityScan — 20 s promo

Created 2026-10-22 · 20 s · 16x9, 9x16 · 60 fps · no loop (ends on a held CTA)

Run autonomously ("just make it"): no stops at the gates, every decision recorded here.

| gate | what | state | notes |
|---|---|---|---|
| 1 | brief + real assets approved | ☑ | the requested domain liqudityscan.io does not resolve; the product is liquidityscan.io. `capture.mjs` (with the new consent/scroll/late-asset passes) pulled the dark-theme UI, logo, fonts and the page's own copy; every claim in the film is quoted in brief.md with its source |
| 2 | style_guide.md + shotlist.md approved | ☑ | the site's own dark grammar: grid paper, Inter Black, neon punchline, mono kickers; arc noise → one thesis |
| 3 | a still for every shot, critiqued | ☑ | stills rounds caught: stats wrapping at every space (abs children of a zero-width abs box), cards overflowing the frame, estimated-width centering, an empty frame at the collapse, a tiny disclaimer |
| 4 | animatic 960×540, placeholder audio | ☑ | skipped as a separate file: a full render takes ≈ 65 s per format |
| 5 | full pass, polish, sound — every score ≥ 8 | ☑ | 4 rounds per format (r01–r08), see below |
| 6 | all formats, loop check, poster, README | ☑ | out/liquidityscan-16x9.mp4, out/liquidityscan-9x16.mp4, posters at 13.0 s; copies and the final review in docs/ |

## Decisions

- 600+ pairs (the live hero and closing section), not the 400+ in the meta description and OG image — see the question below.
- The hook's chart wall is generic market noise drawn in code (tickers, random candles, ICT ping chips), deliberately not LiquidityScan UI. Every product panel after 6 s is a real capture: 4 engine cards, the Confluence live-demo panel, the War Room case card.
- Real UI is revealed, never redrawn: the Confluence rows are uncovered by masks aligned to the capture's own pixel grid.
- No performance, profit or win-rate claims; the site's disclaimer sits on the end card, 30 px, to the last frame.
- Vertical: one column, the panel and the War Room card left-aligned at x 80–920, the disclaimer box inside x < 920; nothing in the top 220 / bottom 420 px or the right button zone.
- COVER is call and response: a stat on 6 / 7 / 8 s (the first one is the drop), a card on the beat after each.
- Chapter exits end on the downbeat and the next chapter lands on it; where they share space this is a clean cut of 2–4 near-empty frames.
- The end card arrives by a push with a 180°-shutter horizontal motion blur; the three candles grow as it lands (the through-line from the 4 s collapse).
- Skill-level fixes found by this film: `capture.mjs` (consent dismissal, scroll-container pass, late images and video, the page's copy in brand.json); `render.mjs` normalizes to −2.5 dBTP and checks the true peak after the AAC encode (it was −0.2 dBFS); `review.mjs` flags peaks above −1 dBTP; new pitfalls in references/composition.md and critique.md.

## Blockers / questions for the user

- **400+ or 600+ pairs?** The meta description and OG image say 400+, the live hero and closing section say 600+. The film says 600+ (one number in `timeline.mjs`).
- **The War Room example values** (78 % confidence, a trigger ladder with prices) are the site's own demo data, shown small and in context as on the site. Drop the card if the owner prefers no numbers at all.
- **Legal and brand sign-off**: the captures, logo and copy come from the public site; the owner should confirm use in paid ads.
- **Listen to it.** The score is synthesized and checked by measurement only (sync, loudness, envelope shape); a human should hear it before it runs.

## Review rounds

| round | format | lowest score | worst defect fixed |
|---|---|---|---|
| stills ×5 | both | — | stats wrapping at every space; cards overflowing; off-center end card; empty frame at the collapse; collapse reading as debris |
| r01–r02 | both | 6 motion, 6 phone (9x16) | the end lockup built on top of the leaving words at 17.5 → a horizontal push; late chapter exits → end on the downbeat; vertical UI and disclaimer inside the right button zone → left-aligned x 80–920 |
| r03–r04 | both | 7 hook, 7 motion | empty first frame → the tile wave starts before t = 0; the push strobing at ~118 px/frame → velocity-driven motion blur; small print on a phone → 30 px; true peak −0.2 dBFS → renderer fix |
| r05–r06 | both | 8 | found only at full size: the poster caught the footer mid-wipe → FIRE holds, poster at 13.0; the cursor rested on the CTA label; the beam crossed card titles |
| r07–r08 | both | 8 | final — every score 8+; review images, reports and critiques copied to docs/liquidityscan-review/ |
