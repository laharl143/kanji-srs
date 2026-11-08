# 0008. Dashboard

**Date**: 2026-10-13 (updated 2026-11-08 for Expo Android)
**Status**: Accepted

## Summary

Home becomes a real dashboard. The Lessons and Reviews cards you already have stay at the top, and three cards are added below them: the next 24 hours of reviews as a list of busy hours, your current level's radical, kanji, and vocabulary progress, and how many items sit in each stage. All the numbers come from one local query, `getDashboard`, which runs on the phone's SQLite database every time Home comes into view. This update replaces the first version, which was written for a Next.js server page. The layout was picked from mockups on 2026-11-08.

## Requirements

**User stories**:
- As a learner opening the app, I see what I can do right now (lessons, reviews) and start it with one tap.
- As a learner planning my day, I see when the next reviews arrive over the next 24 hours.
- As a learner working toward the next level, I see how close I am to the 90% kanji line.
- As a learner, I see how my items spread across Seed, Sprout, Bloom, Harvest, and Retired.

**Acceptance criteria**:
- **AC-1**: Shows lessons available and reviews due now, each with a Start button (disabled at zero). These stay the existing Lessons and Reviews cards at the top of Home.
- **AC-2**: Shows a 24 hour forecast below those cards: one row per local clock hour in the next 24 hours that has reviews becoming due, each with `+N` and a running total that starts from the reviews due now. Hours with zero are hidden. With no reviews in the window, the card says "No reviews in the next 24 hours."
- **AC-3**: Shows current level progress: radicals, kanji, and vocabulary passed / total for your current level, each as a bar in its subject color. The kanji bar has a marker at the 90% line, and a line says how many more kanji you need to level up. The vocabulary bar is labeled so it is clear it does not count toward level up.
- **AC-4**: Shows counts per stage group as five colored tiles: Seed (1 to 4), Sprout (5 to 6), Bloom (7), Harvest (8), Retired (9), using the 0003 stage colors. Zero counts still show.
- **AC-5**: All numbers come from one local query bundle, `getDashboard`, loaded each time Home comes into view; a load failure shows an error card with "Try again". Home reads cleanly at 360dp width with font scale 1.3, in light and dark.

## Decision

**Chosen option**: keep the Home screen's Lessons and Reviews cards and add three cards below them (Next 24 hours, Level N, Stages). Every number comes from one service, `getDashboard(db, userId, now)` in `src/lib/study/dashboard.ts`, built from existing queries in `src/lib/db/queries/assignments.ts`. The forecast is grouped by a pure helper, `bucketForecast`, in `src/lib/srs/forecast.ts`.

**Implementation skills**: `vercel-react-native-skills` (`.agents/skills/vercel-react-native-skills/`), for list and render performance on React Native.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**: no schema change. Reads only:
- `assignments` (`user_id`, `subject_id`, `srs_stage`, `available_at`): due now, the forecast, stage counts, passed counts.
- `subjects` (`level`, `type`): level totals.
- `user_settings.current_level`: which level the progress card shows.

**Service result** (`getDashboard`):
```ts
type Dashboard = {
  lessons: number;                       // stage 0 items
  reviews: number;                       // due now
  forecast: ForecastRow[];               // from bucketForecast, only hours with reviews
  level: {
    level: number;
    radicals: { passed: number; total: number };
    kanji: { passed: number; total: number };
    vocab: { passed: number; total: number };
    kanjiToLevelUp: number | null;       // null at the highest level
  };
  stages: Record<"seed" | "sprout" | "bloom" | "harvest" | "retired", number>;
};
type ForecastRow = { hourStart: number; count: number; runningTotal: number };
```

**Pure helper**: `bucketForecast(times: number[], now: number, reviewsNow: number, startOfHour = startOfLocalHour): ForecastRow[]`. Each time in `[now, now + 24h)` goes into the bucket `startOfHour(time)`. Rows are sorted by `hourStart`, empty hours are never produced, and `runningTotal` adds each row's count to `reviewsNow`. `startOfHour` is injected so tests can pin the time zone; the app uses the device's local time (`Date#setMinutes(0, 0, 0)`).

**API surface** (in app functions, no network):
| Function | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|
| `getDashboard(db, userId, now)` in `src/lib/study/dashboard.ts` | `db: Db`, `userId: string` (from `getCurrentUserId()`), `now: Date` (from `@/lib/clock`) | `Dashboard` | local single user | a DB failure rejects; Home shows the error card |
| `bucketForecast(times, now, reviewsNow, startOfHour?)` in `src/lib/srs/forecast.ts` | review times in ms, `now` ms, count due now | `ForecastRow[]` | n/a (pure) | none; times outside the window are ignored |
| `kanjiToLevelUp(passed, total, atHighestLevel)` in `src/lib/srs/progression.ts`, beside `checkLevelUp` | counts | `number \| null` | n/a (pure) | none |

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| Lessons card | lessons count | `countLessons(db, userId)` |
| Reviews card | reviews due now | `countDue(db, userId, now)` |
| Next 24 hours | review times in the window | `getForecast(db, userId, now, now + 24h)` (already returns raw times, ordered) |
| Next 24 hours | which hour a review falls in | `bucketForecast` with the device's local time zone (`startOfLocalHour`) |
| Next 24 hours | running total start | the same `countDue` result as the Reviews card |
| Next 24 hours | row label | `hourStart` formatted with the device locale as an hour ("3 PM"); the current hour reads "This hour"; a row on the next calendar day is prefixed "Tomorrow" |
| Level N card | current level | `user_settings.current_level` via `getOrCreateSettings` |
| Level N card | passed / total per type | `getLevelProgress(db, userId, level)` (passed means stage 5 or higher, `PASSED_STAGE`) |
| Level N card | 90% marker position | fixed at 90% of the kanji bar width |
| Level N card | "N more kanji to level up" | `max(0, ceil(total * 0.9) - passed)`, the same rule as `checkLevelUp` (`passed * 10 >= total * 9`); `null` (line hidden) when `current_level` is the highest level in `subjects` |
| Stages card | count per group | `getStageCounts(db, userId)` folded through `stageGroup()` from `src/theme/stage.ts`; stage 0 (lesson) is left out |
| Stages card | tile color | `stageClasses[group].bg` (0003 tokens) |

**Key invariants**:
- The running total of the last forecast row equals reviews due now plus every review that becomes due in the next 24 hours.
- The kanji marker and "N more kanji" use the same 90% rule as `checkLevelUp`, so the card never says you can level up when progression would not.
- Stage group mapping lives only in `stageGroup()`; the dashboard never maps stages itself.
- Services and the helper never read the clock; Home passes `now()` from `@/lib/clock`, so the debug clock moves the dashboard too.

**Security model**: single local user, on device only. Every query takes `userId` from `getCurrentUserId()` (root rule), so a future account model needs no dashboard change.

**UI details**:
- Order on Home: header, Lessons card, Reviews card, Next 24 hours, Level N, Stages, then the Developer card in dev builds.
- Loading: the existing card skeleton behavior. Error: one card "Dashboard could not load" with the message and "Try again" (replaces today's "Counts could not load").
- Accessibility: each forecast row reads as one label, for example "At 3 PM, 12 more reviews, 56 total". Each bar has `accessibilityRole="progressbar"` with its passed and total. Each stage tile reads "Seed, 38 items".
- Test IDs: keep `home-lessons-count`, `home-reviews-count`, `home-start-lessons`, `home-start-reviews`; add `home-forecast`, `home-level`, `home-stages`.
- `getHomeCounts` stays for `src/app/reviews.tsx`; Home switches to `getDashboard`.

**Critical test scenarios**:
- `bucketForecast` puts a review due at 10:59 in the 10:00 bucket, skips empty hours, and starts the running total from `reviewsNow`, verifies AC-2.
- A review exactly 24 hours from `now` is outside the window, verifies AC-2.
- `getDashboard` on a seeded `better-sqlite3` database returns the right counts, forecast, level progress (with vocab), and stage groups, verifies AC-1, AC-3, AC-4, AC-5.
- `kanjiToLevelUp` matches `checkLevelUp` at the boundary (17 of 20 needs 1, 18 of 20 needs 0) and is `null` at the highest level, verifies AC-3.
- On the emulator, Home shows all five cards at 360dp with font scale 1.3 in light and dark, and a forced load failure shows the error card, verifies AC-5.

## Build plan

Ordered as a thin end to end thread first (Tracer Bullet), then the cards one by one.

1. [x] `bucketForecast` and `kanjiToLevelUp` pure helpers with Vitest tests, satisfies **AC-2**, **AC-3**
2. [x] `getDashboard` service in `src/lib/study/dashboard.ts` on the existing queries, with a `better-sqlite3` test, satisfies **AC-1**, **AC-5**
3. [x] Switch Home to `getDashboard` (focus refresh, error card with "Try again") and add the Next 24 hours card, satisfies **AC-1**, **AC-2**, **AC-5**
4. [x] Level N card with three bars, the 90% marker, and the "N more kanji" line, satisfies **AC-3**
5. [x] Stages card with five tiles, satisfies **AC-4**
6. [x] Emulator pass at 360dp, font scale 1.3, light and dark; write `verify.md`, satisfies **AC-5**

## Consequences

**Positive**: one glance at Home tells you what to do now, what is coming today, and how close the next level is. No new library and no schema change. The existing cards, IDs, and Maestro flow keep working.
**Negative / tradeoffs**: Home now runs five small queries on every focus instead of two (cheap on local SQLite at this course size, but worth watching as levels grow). The forecast list can reach 24 rows on a busy day, so Home scrolls further. The vocabulary bar shows progress that does not gate level up; the label has to make that clear or it will confuse.

## Follow-up

- [ ] Tapping a stage tile could open the level browser filtered to that stage once feature 10 exists.
- [ ] If Home ever feels slow with many levels, measure before adding any caching.
