# src/components/home

The dashboard cards on Home, below the Lessons and Reviews cards. Governing spec: [0008 Dashboard](../../../docs/specs/0008-dashboard/index.md). Home (`src/app/(tabs)/index.tsx`) loads `getDashboard` on every focus and passes the result in; these components never query the database or read the clock.

## Files

- `DashboardCards.tsx`: `ForecastCard` (`home-forecast`), `LevelCard` (`home-level`), and `StagesCard` (`home-stages`). Each takes `data: Dashboard | undefined` and renders its loading state when `data` is undefined.
- `forecast-label.ts`: `forecastLabel` (the visible row label: the device locale's hour, "This hour", or "Tomorrow 9 AM") and `forecastRowLabel` (the one sentence accessibility label, for example "Tomorrow at 9 AM, 2 more reviews, 44 total"). `formatHour` is injectable so tests pin the locale.

## Rules

- Keep the testIDs `home-forecast`, `home-level`, `home-stages`; Maestro and `verify.md` use them.
- Each forecast row and each stage tile reads as one accessibility label; each level bar has `accessibilityRole="progressbar"`.
- Stage labels and colors come from `@/theme/stage` (`stageGroup`, `groupLabel`); never map stages here.
- The "N more kanji" line and the 90% marker use `kanjiToLevelUp` from `@/lib/srs/progression`, the same rule as `checkLevelUp`.

_Drafted by /sync from the introducing change, worth a quick human pass._
