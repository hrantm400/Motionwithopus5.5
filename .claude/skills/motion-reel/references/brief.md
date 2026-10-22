# The brief

Ask for "an insane product video" and every decision stays open, so the model
fills each blank with the safest default it knows — that is where the centered
gradient title comes from. The films people point at started from production
documents of thousands of characters, not from a sentence. `brief.md` in the
template has the five blocks; this is how to fill them.

## FILM

- **One sentence the viewer keeps.** Not the product's tagline — the thing a
  viewer could repeat after one watch. Every shot must serve it.
- **Audience and placement.** A site hero, an X post, a Reel and a keynote want
  different pace, type size and length. Placement decides the formats.
- **Duration.** 15 s fits 6–8 shots. 20–40 s for launch films. Longer needs a
  story with sections and more than one idea.
- **Loop?** Feeds autoplay and loop; a film that loops ends where it began.
- **CTA.** Exact words and URL. Never paraphrase a CTA.

## ASSETS

Only real material:

- logo (vector), brand colors in hex with roles, licensed font files
- real product screens: screenshots or frames from a real screen recording
- photos, product shots, mascot art, music — whatever exists

From a URL: `capture.mjs <url> <slug>` takes desktop/mobile screenshots, large
images, logo candidates, colors weighted by screen area and the fonts in use.
Look at all of it. The public site never shows the logged-in product; if the
film needs product UI, ask the user for it. A missing interface screenshot is a
blocker, not a placeholder to draw — Opus can invent a camera move, it must
never invent a dashboard, a feature or a number.

## VISUAL

- the reference(s) in `refs/` and what to keep from each (pace, type,
  transitions, camera) — see `storyboard.md` and the reference pass in SKILL.md
- named clichés to avoid (the house list is in CLAUDE.md)
- three words for the tone

## HARD LINE

The rules that are never traded for a better shot: no invented screens or
metrics, numbers only with a source, the brand's legal lines, words never to
use. Put each product fact under "Product facts" with its source so the film
only says true things.

## DELIVER

Shot list, contact sheet, final video per format, poster frame, source. Plus
the autonomy level: stop at every gate, or run and stop only at blockers.

## Keys and services

API keys (a video model for base footage, a TTS voice, a stock library) go in
`.env` at the project root and are referred to by name only — never pasted into
a prompt, a brief or a file that gets committed. `.env` is git-ignored.

## The one-liner still has a job

```
make a dynamic 15-second motion graphics video that shows what an incredible
motion designer you are, like it's your showreel for a résumé. go all out.
```

"Showreel" hands over a genre with known rules, making the model the subject
leaves no product to get wrong, 15 s fits 6–8 shots. Run it once to test the rig,
then move on: hundreds of people sent the same sentence and got reels that rhyme
with each other. For anything with a product, write the brief.

## Tightening a thin request

Three lines turn a vibe into something renderable: the product URL, a demand for
real screenshots, logo and assets, and "must have music". Everything else can
default — but say which defaults you chose in STATUS.md so the user can overrule
them at GATE 1.
