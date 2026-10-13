# 0008. Dashboard

**Date**: 2026-10-13
**Status**: Proposed

## Summary

Turns the minimal home page from 0004 into a real dashboard: what is waiting now, what is coming in the next 24 hours, how close you are to the next level, and how many items sit at each stage.

## Requirements

**Acceptance criteria**:
- **AC-1**: Shows lessons available and reviews due now, each with a Start button (disabled at zero).
- **AC-2**: Shows a 24 hour forecast: reviews becoming due per hour from now, plus a running total; hours with zero are hidden.
- **AC-3**: Shows current level progress: radicals passed / total and kanji passed / total, with a marker at the 90% kanji line.
- **AC-4**: Shows counts per stage group: Seed (1 to 4), Sprout (5 to 6), Bloom (7), Harvest (8), Retired (9), using the 0003 stage colors.
- **AC-5**: All numbers come from one server query bundle and render on the server; the page works at 375px width.

## Decision

**Chosen option**: one server component page calling `getDashboard(userId, now)` in `src/lib/db/queries/dashboard.ts`; forecast bucketing done by a pure helper `bucketForecast(times, now)` in `src/lib/srs/forecast.ts`.

## Feature design

**Value sourcing**:
| Value | Source |
|---|---|
| lessons, reviews now | `countLessons`, `countDue(userId, now)` |
| forecast | `getForecast(userId, now, now + 24h)` → `bucketForecast` |
| level progress | `user_settings.current_level` + assignments for that level's subjects |
| stage groups | assignments grouped by `srs_stage` |

**Critical test scenarios**:
- `bucketForecast` puts a review due at 10:59 in the 10:00 bucket and skips empty hours, verifies **AC-2**
- Level progress shows the marker and correct counts with a seeded level, verifies **AC-3**

## Build plan

1. `bucketForecast` pure helper + tests, satisfies **AC-2**
2. `getDashboard` query bundle, satisfies **AC-5**
3. Dashboard sections using 0003 components, satisfies **AC-1** to **AC-4**

## Consequences

**Positive**: one glance tells you what to do today.
**Negative / tradeoffs**: no charts library; the forecast is a simple list or bar row.
