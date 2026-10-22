# LiquidityScan — 20 s promo

An English promo for [liquidityscan.io](https://liquidityscan.io) (the request said
liqudityscan.io, which does not resolve). The one sentence the viewer keeps: stop
babysitting the charts — LiquidityScan watches 600+ pairs and only escalates when
every timeframe agrees. Made with `/motion-reel` in one autonomous run, as a test
of the skill.

The arc is noise → one thesis: a wall of generic charts and pings (the problem),
a freeze-cut, the wall collapses into the brand's three candles, then the
product's own three jobs — Cover (real engine cards), Confirm (the real
Confluence panel firing) and Decide (the real War Room case) — and an end card
with Start free.

- **Files:** `out/liquidityscan-16x9.mp4`, `out/liquidityscan-9x16.mp4`, posters (13.0 s) in `out/` after a render — committed copies in [`docs/`](../../docs/)
- **Source:** `src/index.html` (picture), `src/timeline.mjs` (the clock), `src/score.mjs` (sound)
- **Real assets:** `assets/screens/` (dark-theme captures of the site), `assets/logo/mark.svg` (the site's favicon), `assets/fonts/` (Inter, JetBrains Mono, Outfit — OFL, licenses alongside)
- **Decisions:** [`brief.md`](brief.md) (every claim with its source), [`style_guide.md`](style_guide.md), [`shotlist.md`](shotlist.md), [`STATUS.md`](STATUS.md)
- **Final review:** [`docs/liquidityscan-review/`](../../docs/liquidityscan-review/)

Re-render and re-review from the repo root:

```bash
npm run render -- liquidityscan --format all
npm run review -- liquidityscan --format 16x9
npm run preview        # then open /films/liquidityscan/src/ and press space
```

Re-capture the site (raw output goes to `assets/site/`, git-ignored):

```bash
npm run capture -- https://liquidityscan.io liquidityscan
```

Open issues (details in STATUS.md): 400+ or 600+ pairs (the site says both);
the War Room card shows the site's example values; the owner should sign off on
using the site's captures in ads; the synthesized score was checked by
measurement only — listen before it runs.
