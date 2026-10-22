# seek(t) — the motion-reel demo

A 16-second loop about the pipeline itself: a film is a function of time, so an
agent can render any frame, judge it and fix it. Made with `/motion-reel`.

- **Files:** `out/demo-16x9.mp4`, `out/demo-9x16.mp4`, posters in `out/` (after a render) — committed copies in [`docs/`](../../docs/)
- **Source:** `src/index.html` (picture), `src/timeline.mjs` (the clock), `src/score.mjs` (sound)
- **Decisions:** [`brief.md`](brief.md), [`style_guide.md`](style_guide.md), [`shotlist.md`](shotlist.md), [`STATUS.md`](STATUS.md)
- **Final review:** [`docs/demo-review/`](../../docs/demo-review/)

Re-render and re-review from the repo root:

```bash
npm run render -- demo --format all
npm run review -- demo --format 16x9
npm run preview        # then open /films/demo/src/ and press space
```

Open issues: none blocking. The first frame is bare paper so the loop is
seamless; use the poster (06.90 s) as the cover.
