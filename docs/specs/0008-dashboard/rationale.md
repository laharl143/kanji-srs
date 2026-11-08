# 0008. Dashboard: rationale

## Context

The first version of this spec (2026-10-13) was written for a Next.js web app: one server component page that rendered every number on the server, checked at 375px browser width. Spec 0001 moved the app to Expo Android on 2026-11-01, so there is no server. All data lives in the phone's local SQLite database, and screens load it in effects.

Home today (spec 0004 AC-12) shows two cards, Lessons and Reviews, with counts that refresh whenever Home comes back into view. The Maestro core loop flow and several scripted checks rely on those cards and their test IDs.

Most of the queries the dashboard needs already exist in `src/lib/db/queries/assignments.ts`: `countLessons`, `countDue`, `getForecast` (raw times in a window), `getStageCounts`, and `getLevelProgress` (passed and total per subject type for one level). Level up happens at 90% of the current level's kanji passed (`checkLevelUp` in `src/lib/srs/progression.ts`). Stage groups and colors come from `stageGroup()` in `src/theme/stage.ts` (spec 0003).

## Options considered

The options were shown as phone mockups on a private artifact page, and you picked on 2026-11-08.

**Layout**
- **A. Keep today's cards, add three below** (chosen). Pro: no change to what works, least code, IDs and the Maestro flow keep passing. Con: the Stages card sits below the fold.
- **B. Compact rows like the reference screenshots.** Pro: everything fits on one screen. Con: smaller tap targets, and it replaces the current cards and their IDs.
- **C. Two big tiles, a bar chart, then progress.** Pro: the most visual. Con: drawing code with no chart library, and whole tile buttons need care to read as tappable.

**Forecast**
- **A. List of busy hours with a running total** (chosen). Pro: matches the original AC-2 and reads well with TalkBack. Con: can grow to 24 rows.
- **B. 24 bar strip.** Pro: compact and fixed height. Con: exact counts hide behind a label.
- **C. Next review time plus next hour and next day totals.** Pro: simplest. Con: drops the hour by hour detail.

**Level progress**
- **A. Radicals and kanji bars with the 90% mark.** Pro: exactly what decides level up. Con: vocabulary progress is not visible.
- **B. Add a vocabulary bar** (chosen). Pro: all three subject colors, and you can see your vocabulary progress. Con: vocabulary never gates level up, so the bar can mislead.

**Stages**
- **A. Five colored tiles** (chosen). Pro: every number visible, zeros included. Con: tiles must stay readable at 360dp with font scale 1.3.
- **B. One stacked bar with a legend.** Pro: shows the share at a glance. Con: small slices are hard to see.

**Data loading** (decided by the architect, not asked)
- **One service bundle, `getDashboard`** (chosen). Pro: one call, one loading state, one error card, easy to test on `better-sqlite3`. Con: one slow query delays the whole screen.
- **One hook per card.** Pro: cards load on their own. Con: four loading and error states on one screen, and more code for no measured gain.

## Rationale

Layout A keeps what already works. Home's Lessons and Reviews cards, their test IDs, and the Maestro flow are proven, so adding below them is the smallest safe change, and it matches the project's Tracer Bullet approach (thicken what exists). Forecast A is the original AC-2 unchanged, it needs no drawing code, and a list reads naturally with TalkBack.

You chose the vocabulary bar (Level B) over the recommended two bar version. That works; the risk is that vocabulary looks like it counts toward level up. The spec handles this with a label on the vocabulary bar and by putting the 90% marker and the "N more kanji" line only on the kanji bar.

One service bundle fits a local database: the queries take milliseconds, and one loading state is simpler than four. The 90% line reuses the exact `checkLevelUp` rule, so the card can never disagree with what progression actually does. The forecast helper takes an injected start of hour function, so tests can pin the time zone while the app uses the phone's local time.
