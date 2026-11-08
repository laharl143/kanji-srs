# src/theme

Design tokens and the pure helpers that pick colors. Governing spec: [0003 UI foundation](../../docs/specs/0003-ui-foundation/index.md).

## Files

- `../global.css`: the source of truth for every token, as CSS variables. Light values under `:root`, dark values under `@media (prefers-color-scheme: dark)`. `tailwind.config.js` maps each token to a class (`bg-bg`, `text-primary`, `bg-stage-seed`, ...).
- `colors.ts`: the same values as raw hex, for APIs that cannot take a class name (navigation theme, tab bar tint, status bar, icons). `paletteFor(scheme)` returns one theme.
- `use-palette.ts`: `usePalette()` gives the raw palette for the current system theme. Use it in components instead of reading `colors` directly, so raw colors switch live with the theme.
- `stage.ts`: `stageGroup(srsStage)` is the only place that maps an SRS stage to a group, label, and color class. `null` means locked (no assignment); a stage outside 0 to 9 throws. `groupLabel(group)` gives the label for a group alone (the Home stage tiles).
- `../../metro.config.js` passes `inlineRem: 16` to `withNativeWind`, so Tailwind rem sizes match the specs (`min-h-12` is 48dp, `text-base` 16sp). NativeWind's default of 14 made every rem size 1/8 too small; keep it at 16.
- `progress.ts`: `progressFraction(value, max)`, clamped to 0..1, and 0 when `max` is 0 or less.

## Rules

- Change a token in **both** `src/global.css` and `colors.ts`. The parity test in `colors.test.ts` fails if they differ.
- Contrast is checked in `colors.test.ts`. The pairs that miss their target today are listed in `KNOWN_GAPS` (owed to `/architect UI foundation`). A new failing pair fails the test; fixing a gap means removing it from that list.
- Subject colors (radical blue, kanji pink, vocab purple) are the same in both themes.
- Keep these helpers pure: no React, no DB, so Vitest can test them directly.

_Drafted by /sync from the introducing change, worth a quick human pass._
