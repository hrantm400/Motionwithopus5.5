---
name: motion-reel
description: Make motion design videos with code — launch films, product promos, UI motion, showreels, kinetic type, data stories and social clips (vertical, square, wide) — as deterministic seek(t) HTML compositions rendered to MP4 with Playwright and ffmpeg, a soundtrack synthesized on the same clock, and a self-critique loop on contact sheets before anything is shown. Use it whenever someone asks for a video, promo, launch film, reel, motion graphics, an animated product demo, "make it move", gives a product URL to turn into a film, wants a film re-cut to another aspect ratio, or wants a film in films/ fixed, re-timed, re-scored or reviewed — even if they never say "motion-reel".
argument-hint: "[url | product | brief.md] [duration] [vertical|square|wide|all] [ref ./refs/x] [music ./song.wav] [overnight]"
allowed-tools: Bash(npm run new *) Bash(npm run render *) Bash(npm run review *) Bash(npm run capture *) Bash(npm run reference *) Bash(npm run beats *) Bash(npm run preview) Bash(node ${CLAUDE_SKILL_DIR}/scripts/render.mjs *) Bash(node ${CLAUDE_SKILL_DIR}/scripts/review.mjs *) Bash(node ${CLAUDE_SKILL_DIR}/scripts/new-film.mjs *) Bash(node ${CLAUDE_SKILL_DIR}/scripts/capture.mjs *) Bash(node ${CLAUDE_SKILL_DIR}/scripts/reference.mjs *) Bash(node ${CLAUDE_SKILL_DIR}/scripts/serve.mjs) Bash(python3 ${CLAUDE_SKILL_DIR}/scripts/beats.py *) Bash(ffprobe *)
---

# Motion reel

Make films the way the strongest "one-prompt" videos were really made: a
program that paints any frame on demand, a production brief instead of a vibe,
a borrowed visual grammar instead of the default look, sound on the same clock
as the picture, and a critic that studies the rendered frames before anyone
else sees them. The prompt is about a tenth of the result; this harness is the
rest, and it carries over, so the tenth film comes out better than the first.

Request: $ARGUMENTS

Effort is `${CLAUDE_EFFORT}`. New films want xhigh; a launch whose first three
seconds have to carry it wants max. If this is a new film and effort is lower,
say so once (`/effort xhigh`) and carry on.

## 0. Read the request

Pull out, and default what is missing instead of asking about it:

- **subject** — a URL, a product name, or a path to a brief. A product film without real assets cannot be made honestly; see GATE 1.
- **duration** — default 15 s (6–8 shots). Showreels 15 s, launch films 20–40 s.
- **formats** — wide `16x9`, vertical `9x16`, square `1x1`, `4x5`, or all. Default: what the platform implies, else 16x9.
- **reference** — frames, a clip or a folder in `refs/`. None given → propose one named style in the style guide.
- **music** — a supplied track (`assets/audio/…`) or a synthesized score (default).
- **autonomy** — by default stop for approval at GATE 1 and GATE 2. "Overnight", "don't stop" or "just make it" → stop only at blockers and record every decision in STATUS.md.

If the request names an existing film (`films/<slug>`), read its STATUS.md and
resume at the first open gate. One brand keeps one film folder lineage: reuse
its style guide, assets and score rather than starting over.

## 1. The one rule: seek(t)

Opus cannot output an MP4. Every film is a program: `seek(t)` paints exactly
what the screen shows at second t, a headless browser calls it once per frame,
and ffmpeg glues the frames. Because nothing runs on a timer, any frame renders
on its own — the renderer draws frames in parallel pages and out of order, and a
title that lands too early is one number and a re-render of two seconds.

What that demands of the composition (the runtime enforces most of it):

- the picture depends on `t` alone — no `requestAnimationFrame`, `setTimeout`, `Date.now`, CSS transitions or animations driving anything
- randomness is seeded: `rng(seed)` in setup, `hash01(i)` / `noise1(t)` in seek; never `Math.random` inside seek
- every property of every element is set on every frame; hide whole groups with `display:none` so nothing a previous frame left behind can leak
- assets are local files (fonts in `assets/fonts`, screens in `assets/screens`); the runtime waits for them and refuses to render if one is missing

Read `references/composition.md` before writing `src/index.html` — it has the
`defineFilm` contract, the motion library (springs, tracks, morph, cursor,
typing, seeded noise, OKLab color) and the pitfalls the review will catch.

## 2. Studio layout

```
films/<slug>/
  brief.md         goal, audience, real assets, hard lines        ← GATE 1
  style_guide.md   palette, type, motion feel, pace, banned        ← GATE 2
  shotlist.md      beats: entry state → exit state, purpose, sound ← GATE 2
  STATUS.md        gates, decisions, blockers, review rounds  (keep it current)
  assets/          approved fonts, screens, logos, audio (+ site/ from capture)
  refs/            references and their analysis
  src/             index.html (picture) · timeline.mjs (the clock) · score.mjs (sound)
  reviews/         stills sheets and review rounds rNN-<format>/   (not committed)
  out/             <slug>-<format>.mp4, posters, animatics        (not committed)
```

`timeline.mjs` is the single clock: shots, state changes, cues, beats. Both the
picture and the score import it, so a hit can never drift off its frame.

## 3. Tools

Run the studio through npm, spelled exactly as below: the project's
`.claude/settings.json` pre-approves these `npm run` commands for the whole
session, on any machine, and everything after `--` goes to the script, never to
node. npm runs them from the project root, so paths are relative to it. If the
skill was installed where there is no studio `package.json` (for example in
`~/.claude/skills/`), run the same scripts directly:
`node ${CLAUDE_SKILL_DIR}/scripts/render.mjs <slug> …` (`beats.py` with `python3`).

| step | command |
|---|---|
| new film from the template | `npm run new -- <slug> --duration 15 --formats 16x9,9x16` |
| pull real public assets from a site | `npm run capture -- <url> <slug> [--pages /,/pricing]` |
| take a reference clip apart | `npm run reference -- films/<slug>/refs/clip.mp4` |
| measure a music track | `npm run beats -- films/<slug>/assets/audio/song.wav --out films/<slug>/src/beats.json` |
| stills for every shot (+ sheet) | `npm run render -- <slug> --stills shots [--format all] [--guides]` |
| animatic at half size (960×540 / 540×960) | `npm run render -- <slug> --scale 0.5` |
| re-check a few seconds | `npm run render -- <slug> --from 4 --to 7` |
| full render | `npm run render -- <slug> --format all` |
| review pack | `npm run review -- <slug> --format 9x16` |
| preview for a human (scrub, sound, guides) | `npm run preview` → open the printed URL |

Render prints contract violations (clock or randomness inside `seek()`) and
fails on missing assets or page errors — read its output, don't skim it.

## 4. The gates

The agent can work for hours between gates. Update STATUS.md at every one.

**GATE 1 — brief and real assets.** Fill `brief.md` (FILM, ASSETS, VISUAL,
HARD LINE, DELIVER — see `references/brief.md`). For a product, run
`capture.mjs` on its site, look at what came back, and list what is still
missing. A missing interface screen is a blocker: ask for it. Never draw a
convincing fake of a product UI, feature or number. Stop for approval unless
the run is autonomous.

**GATE 2 — style guide and shot list.** With a reference, run `reference.mjs`,
study its sheets, and write `style_guide.md` from the grammar (palette in hex
with roles, type, shot lengths, transitions, camera, motion feel per object
class) — never its subjects, logos or copy. Without one, name a style and
commit to it. Write `shotlist.md` as a state list: every beat has an entry
state, an exit state and a reason to exist (`references/storyboard.md`). Show
both files and stop for approval unless autonomous.

**GATE 3 — stills.** Write `timeline.mjs` and `index.html` (`new-film.mjs`
gave a working skeleton), then `render.mjs --stills shots --format all`.
Read every sheet as the critic would: layout per format, type size, the
platform zones on vertical (`--guides`). Fix before animating — 900 polished
wrong frames cost more than one test frame.

**GATE 4 — animatic.** `render.mjs --scale 0.5` (half size) with the score in place (even a
rough one), then `npm run review -- <slug> --video films/<slug>/out/<slug>-<format>-animatic.mp4`.
Pacing, dead beats and sync show up here at a quarter of the cost.

**GATE 5 — full pass.** Full render, then the critic loop below until every
score is 8 or more. Polish motion feel and sound here, not earlier.

**GATE 6 — delivery.** Every format from the same timeline (never a crop:
vertical gets bigger type and fewer elements, square tighter holds, wide more
spatial context), loop check if it loops, poster frame, and a short README in
the film folder: what was made, the files, how to re-render, open issues.

## 5. The critic loop

The habit every clip that blew up had in common: Opus reads images, so it
looks at what it rendered. After each render:

1. `npm run review -- <slug> --format <f>` — builds contact sheet, motion strip, phone test, loop seam, signals chart, loudness, sync and determinism checks.
2. Read **every** image it lists and `report.md`. Judge only the rendered frames, not what you meant to make.
3. Fill `critique.md` in that review folder: score 1–10 for hook, phone readability, motion, variety, sound sync, brand accuracy; then the **three worst defects**, each with timestamp, evidence and a local fix.
4. Patch those seconds, check them with `--from/--to` or `--stills`, re-render, review again.
5. Stop when every score is 8+ in every format. If six rounds don't get there, ship the best version and list what remains in STATUS.md — honestly.

What to hunt for, and how to read each image: `references/critique.md`.
Automatic flags (static stretches, silence, unsynced cues, loudness, loop pop,
determinism, contract lint) are leads, not verdicts — an intentional hold for
reading is fine; a 3-second still nobody chose is a dead beat.

## 6. Sound

Sound runs on the same clock as the picture. `score.mjs` synthesizes the score
and SFX in plain JS from `timeline.mjs` (`references/sound.md`): every state
change gets one sound, whooshes crest on the cut, risers end on the downbeat,
the drop leaves room. With a supplied track, measure it first with `beats.py`
and put state changes on beats, big moments on downbeats, clicks on hits. The
renderer mixes and normalizes to −14 LUFS. You can't listen: the signals chart
and the sync numbers are your ears. Blindfold test — if the audio row in
`signals.png` has no shape of its own, the sound design is unfinished.

## 7. Taste defaults

Unless the style guide says otherwise:

- banned: centered title on a gradient, everything fading in, corner labels, glow on UI, stock "tech" blobs
- one display face, one UI face, one accent color
- something new on screen every 2–4 s; nothing static for 3 s unless it is a deliberate hold
- motion with mass: springs per object class (`feel.ui`, `panel`, `camera`, `headline`, `cursor`, `mascot`) — if everything overshoots, nothing feels precise
- geometry glides, color cuts on the beat (tweening ink into a saturated accent goes through mud)
- one shape that never cuts beats ten effects; a cursor drives changes with real clicks
- the last frame leads into the first if the film loops

## 8. Stop and ask when

- a product screen, logo, font or claim is missing — ask, don't fake it
- the reference is ambiguous — render one test frame and ask, before 900 wrong ones
- a brand rule conflicts with the brief
- the request implies photoreal scenes, complex characters or organic motion: say plainly that code loses there and suggest footage or a video model as a base layer (generate-then-trace: see `references/composition.md`)

## References

- `references/brief.md` — the production brief, product facts, keys in `.env`, the showreel one-liner
- `references/storyboard.md` — state lists, the one morphing shape, entry/exit/purpose, per-format layout
- `references/composition.md` — `defineFilm`, the motion library, layout per format, assets, pitfalls, generate-then-trace
- `references/sound.md` — `score.mjs`, the synth, beats.json, mixing and loudness
- `references/critique.md` — the review pack image by image, the rubric with anchors, the defect list
