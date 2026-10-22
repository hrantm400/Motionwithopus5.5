# Brief — seek(t), the motion-reel demo

```
FILM      one sentence the viewer keeps: a film is a function of time — so an agent can
          render any frame, judge it, and fix it.
          audience: people who saw the "one-prompt" Opus videos and want the real method
          where it runs: the repo README, X / LinkedIn (16:9), Reels / TikTok / Shorts (9:16)
          duration: 16 s · formats: 16x9, 9x16 · 60 fps · loop: yes (ends on bare paper)
          call to action (exact words): /motion-reel your-product.com

ASSETS    logo: none — the subject is the technique, not a product
          real UI screenshots: none needed; every screen in the film is the film itself
          (the contact-sheet tiles and format frames are this film's own states, drawn small)
          brand type: Inter Display Bold, Inter Medium, JetBrains Mono — OFL/Apache, in assets/fonts/
          brand colors: paper #F1EEE7 · ink #111111 · accent #FF4F1A
          audio: synthesized score and SFX (score.mjs), 120 bpm, D minor

VISUAL    reference: Swiss editorial — hairline grid, flush-left type, one accent
          keep: big flush-left headline, mono captions, one shape that never cuts
          avoid: centered title on a gradient, fade-ins, glow, corner labels, stock UI
          tone in three words: exact, calm, mechanical

HARD LINE no invented product, no invented metrics. The critic's "6/10 → 9/10" badge
          illustrates the review step; it is not a claim about any product.

DELIVER   shotlist.md · contact sheets in reviews/ · out/demo-16x9.mp4 · out/demo-9x16.mp4
          · poster frames · source in src/
          autonomy: built in one session with the critic loop, no human gates (demo)
```

## Product facts (each with its source)

- The pipeline renders each frame by calling `seek(t)` in headless Chromium and encodes
  with ffmpeg — `.claude/skills/motion-reel/scripts/render.mjs`
- The review pack (contact sheet, strip, phone test, seam, signals, determinism) —
  `.claude/skills/motion-reel/scripts/review.mjs`
- `/motion-reel` is the skill's slash command — `.claude/skills/motion-reel/SKILL.md`

## Open questions

- none
