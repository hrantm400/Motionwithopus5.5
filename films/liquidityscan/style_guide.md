# Style guide — LiquidityScan promo

Grammar taken from the site's own dark theme (liquidityscan.io with the moon toggle
on): black-navy grid paper, white Inter Black headlines whose punchline turns neon
green, mono uppercase kickers, rounded dark cards. The film should feel like the
site came alive — not like a generic crypto ad.

## Palette (hex, with roles)

| role | hex | notes |
|---|---|---|
| background | `#090C11` | with a 1 px grid at 4% white, 96 px cells (as the site) |
| surface | `#11161F` / `#141A25` | generic chart tiles, chips |
| ink | `#F3F4F6` | headlines, wordmark "Liquidity" |
| muted | `#94A3B8` / `#6B7280` | body copy, wordmark "Scan", disclaimer |
| accent (one) | `#13EC37` | punchline words, kickers, the CTA pill (text `#021805`), the scan beam |
| market red / green | `#E5484D` / `#22C55E` | candles only — the market, not the brand |

The real UI captures keep their own colors (purple, amber, mint) — they are the
product, shown as is.

## Type

- headlines: Inter Black 900 · tracking −0.035em · sentence case · line-height 0.98
- kickers: JetBrains Mono Bold · uppercase · tracking 0.22em · accent green, e.g. `01 · COVERAGE`
- body / stats labels: Inter Medium
- wordmark: Outfit Bold — "Liquidity" ink, "Scan" muted (exactly as the site header)
- CTA: Outfit Bold uppercase · tracking 0.16em · `START FREE →`
- scale: wide headline 120–168 px · vertical 120–140 px · kicker 26 px (wide) / 28 px (vertical)

## Motion

| object class | feel | notes |
|---|---|---|
| chart tiles, ping chips, UI chips | feel.ui | pop from 0.6×, no visible overshoot |
| real UI panels and cards | feel.panel | rise 80 px and settle |
| headline lines | feel.headline | rise behind a mask, hold, leave together |
| the wall push-in, the card carousel | feel.camera / linear | glide, never bounce |
| row reveals in the confluence panel | ease.outCubic wipe, 0.35 s | machines reveal, they don't bounce |
| cursor (end card) | feel.cursor | arcs in, presses Start free |
| color | cut on the beat | never tween dark into neon |

## Pace and transitions

- 120 bpm: beat 0.5 s, bar 2 s, 10 bars; every change on the grid, big moments on downbeats
- shots: 4 / 2 / 4 / 4 / 2 / 4 s; one hard freeze-cut at 4.0 s, then the wall collapses into the mark (a morph);
  the War Room card slides over the pushed-back panel (14.0); a motion-blurred push into the end card (17.4);
  the other chapters change on the downbeat — the exit ends on it, the entry starts on it
- the chaos accelerates through the hook, then everything gets calmer and more ordered — the film's arc is noise → one thesis

## Texture

- the site's grid; a very faint green wash in the top-left corner (as the site), nothing else
- no grain, no lens effects, no glow on UI

## Banned here

- coins, rockets, profit curves, "to the moon", fake P&L
- centered title on a gradient · everything fading in · corner labels · glow on UI
- tweening `#090C11` into `#13EC37`
- text in the vertical platform zones (top 220, bottom 420, right 140 px around y 920–1500)
