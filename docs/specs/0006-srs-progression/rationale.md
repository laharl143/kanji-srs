# 0006. SRS progression: rationale

The decision record behind [index.md](index.md).

## Context

0006 was written on 2026-10-13 for the Next.js web app: a server side `afterReview(userId, now)`, a Playwright test for wrap up, and `/reviews` as a server page. Spec 0001 moved the product to an offline Expo Android app on 2026-11-01. Its Follow-up fixed several rules for this spec: unlock eligibility by `subject.level <= current_level` in one function inside the review transaction; level up as `passed * 10 >= total * 9`, with a level of 0 kanji leveling up at once; no review rows from the lesson quiz; session state in memory only; accuracy as questions right on the first try over questions answered. It left the review queue's order and cap open.

Feature 5 (0004) built what this extends. `applyReview` already sets `passed_at` and `burned_at`. The session queue shuffles every question of every due item together, and leaving a session drops every half done item. Each completed lesson item and each review is its own `withTransaction`, and `withTransaction` cannot nest. `runStartup` unlocks a fixed starting set on first launch. Lesson order (lowest level, then radicals, kanji, vocab, then position) is built and tested. Spec 0002 added `getUnlockInputs`, `getLevelProgress`, and `insertAssignmentsIfMissing` for this feature.

Feature 6 shipped levels 1 to 3: 357 subjects, 25 kanji per level, and every kanji has radicals (level 1 has 35 radicals). Four level 2 kanji (下山午先) use only level 1 radicals. The course has 25 levels; the rest arrive in waves (feature 12), each as a new APK.

Forces that shaped this revision:
- **Pure rules** (root `AGENTS.md` ground rule 5, 0001 §3): SRS logic takes plain objects and `now`, and never touches the database.
- **Later sync** (0001 Deferred decisions): assignments will be rebuilt by replaying the review log through `src/lib/srs`.
- **Small, local data**: one user, offline, at most about 2,400 subjects and as many assignments.
- **Content in waves**: only levels 1 to 3 exist on the phone today, and a level with no kanji counts as passed.
- **Phone sessions are short and get interrupted**, and big piles of reviews build up after a break.
- **Checking by hand**: no EAS build until release (scope header), so checks run in Expo Go. Reaching level 2 for real takes 23 level 1 kanji at stage 5, each needing four correct reviews over 3.5 days of debug clock after its radicals did the same.
- **The Maestro flow** (`maestro/core-loop.yaml`) expects "Done, 5 items" after reviews.
- **Build approach**: Tracer Bullet.

## Options considered

### Option 1: A pure planner that recomputes everything, run inside each review's transaction and on every launch (chosen)

`computeUnlocks`, `checkLevelUp`, and `planProgression` take every subject, every assignment, and the current level. `runProgression` loads them, writes the difference through the caller's transaction, and runs after every review and on every launch.

**Pros**: one code path covers first launch, reviews, content waves, and skip ahead; a missed or failed run is repaired by the next one; plain functions are easy to test in Node; a sync replay can run the same code.
**Cons**: work grows with the whole course on every review, even when nothing can change; a bug in it blocks review saves.

### Option 2: Incremental unlocks from the item just passed

When a review lifts an item to stage 5 or above, load only the subjects that use it (`getUsedIn`), unlock those whose other components are passed, then recount the current level. First launch, level up, and content waves each get their own unlock step.

**Pros**: very little work per review, and none for most reviews.
**Cons**: three or four unlock paths that must agree; a missed run is never repaired; content waves need a full scan anyway.

### Option 3: Unlock rules in SQL

One `INSERT ... SELECT` with `json_each` and `NOT EXISTS` unlocks every eligible subject, and one grouped query checks the level.

**Pros**: fastest; one statement per step.
**Cons**: moves SRS rules out of `src/lib/srs`, against ground rule 5, so a later sync replay cannot reuse them; edge cases are harder to test than in plain functions.

## Rationale

Option 1 fits the forces. The data is small, so a full recompute costs tens of milliseconds, while Option 2 saves that cost by adding several code paths that can drift apart. The full recompute is also what makes content waves work with no extra code: when a new APK adds levels, the launch run sees the new rows and levels you up. Pure rules satisfy ground rule 5 and the deferred sync design, which Option 3 gives up. The 0001 Follow-up already asked for one function inside the review transaction, and Option 1 is that function. If the per review cost ever shows on a phone, the escape hatch is known: run it only when a review crosses stage 5.

Choices made with you on 2026-11-07. You picked the first three; for every remaining choice in this run you asked me to take the recommended option, so the rest are my picks (runner up after each):
- **Review window**: 10 items in play (your pick). Runner up: keep feature 5's all at once queue, which drops every half done item when you leave and lets an item's two questions drift far apart.
- **Session cap**: none (your pick); Wrap up ends a session whenever you like. Runner up: stop at 50 items.
- **Wrap up**: can be taken back with Keep going (your pick). Runner up: final once pressed.
- **Join order**: random, matching 0001's "shuffled together". Runner up: oldest due first.
- **Last level**: stay at the highest level that has content; a later launch with more levels levels you up. Runner up: level up into an empty level, rejected because a level with no kanji counts as passed, so it would chain through every missing level.
- **Level up news**: a banner on the summary. Runner up: a toast mid session, easy to miss while typing.
- **Summary list**: two groups, Correct and Incorrect, each item with its old and new stage (0001 §8). Runner up: counts only.
- **Summary buttons**: Home always, plus Start lessons and Keep reviewing when each has something waiting. Runner up: Home only.
- **Data model**: no change and no level history table. Runner up: a `level_progress` table with start and pass times, left until a screen needs it.
- **Proving it on the phone**: a dev only "Move level N to stage 4" button on `/dev/clock`. Runner up: Vitest for level up plus the debug clock by hand for radicals to kanji.
- **Item details after a wrong answer**: noted for 0007, not built here. Runner up: build it in this feature.
- **References section**: none.

Small calls (pick, then runner up):
- **One unlock rule for every subject**: a subject unlocks when its level is reached and all its components are passed, so radicals (no components) need no special case and the first launch set falls out of the same rule. Runner up: keep 0004's separate first launch query, a second copy of the rule.
- **Find the final level, then unlock once**: unlocks only add stage 0 rows, which never change a passed count, so the planner loops the level up check first and computes unlocks once at the final level. Runner up: alternate unlock and level steps, same result with more work.
- **Progression on every launch**, not only after a reseed, so a run lost to a crash is repaired. Runner up: only after a reseed.
- **The summary keeps "Done, N items"** and the existing test IDs, so the Maestro flow needs no change. Runner up: a new title and a flow edit.
- **Joining questions go to random positions**, which keeps the mix after the first 10 items. Runner up: append them at the end, which turns the rest of the session into back to back pairs.
- **Accuracy stays hidden until the first answer**, instead of a meaningless 0% or 100%. Runner up: show a placeholder.
- **`runStartup` keeps returning `{ reseeded }`**, since nothing on screen uses a launch level up yet. Runner up: return the progression result too.

Cross check fixes (2026-11-07; an independent read of the spec on another model found these open, and you accepted the recommended fix for each):
- **An item leaves the window at its last right answer**, and a failed save after that brings in nothing. Runner up: also bring in an item when a failed save drops one, which can put 11 in play.
- **Keep going refills the window to 10 at once**, placing the new questions after the one on screen. Runner up: refill only as items finish, which keeps the window at the size wrap up shrank it to.
- **No mark when the stage did not change** (a wrong answer at Seed 1). Runner up: a down mark, which reads as a drop that did not happen.
- **Accuracy rounds down**, so 100% means no misses. Runner up: round to the nearest, which shows 100% at 199 of 200.
- **Home only if the summary's count read fails.** Runner up: an error card, heavy for two optional buttons.

Later change (2026-11-08, your choice after `/check verify`): no screen reader checks. This is a private app and you will not use a screen reader, so TalkBack is not a target, and its step left `verify.md` and the by hand scenario. The accessibility labels stay, because the scripted checks read the screen through them (Android's screen dump shows them). Runner up: keep the TalkBack step, which needs a listening pass on a phone for every feature.
