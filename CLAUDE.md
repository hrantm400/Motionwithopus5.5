# Motion studio

This repo makes films with code. The `/motion-reel` skill
(`.claude/skills/motion-reel/`) holds the pipeline; films live in `films/<slug>/`.
`films/demo/` is a finished example — copy its habits, not its look.

## Render contract

- `seek(t)` paints frame t; nothing else drives the picture
- no CSS transitions, setTimeout, setInterval or requestAnimationFrame driving anything
- seeded noise only (`rng`, `hash01`, `noise1` from motion.mjs), never Math.random in seek
- set every property every frame; hide groups with `display: none`
- fonts and product screens are local files in the film's `assets/`

## Look

- banned: centered title on gradient, everything fading in, corner labels, glow on UI
- one display face, one UI face, one accent
- something new on screen every 2 to 4 seconds
- geometry glides on springs (one feel per object class); color cuts on the beat
- every format from the same timeline, never a crop

## Sound

- score and SFX synthesized in code (`score.mjs`) unless a track is supplied, −14 LUFS
- every state change gets one sound, on its frame

## Real assets only

- never invent product screens, features or metrics; a missing screen is a question for me
- API keys live in `.env`; refer to them by name, never paste them

## Before you show me anything

- render one frame per beat as a contact sheet, score it, fix the worst 3
- run `review.mjs` on every export and read every image it lists
- keep `films/<slug>/STATUS.md` current — it is how the next session resumes

## Commands

```
npm run new -- <slug> --duration 15 --formats 16x9,9x16
npm run render -- <slug> [--format all] [--stills shots] [--scale 0.5] [--from 4 --to 7]
npm run review -- <slug> --format 16x9
npm run preview          # scrub a film in the browser
```
