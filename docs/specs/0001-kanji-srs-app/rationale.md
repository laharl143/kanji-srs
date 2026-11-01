# 0001. Rationale

## Context

You want a WaniKani style kanji course without the monthly subscription. Copying WaniKani content (scraping or the API) is off the table: it is the paid product, and the API needs a subscription past level 3. So the app must be built from free, openly licensed data plus original mnemonics.

Constraints that shaped the design:
- Planning happens in Claude Code; building happens in IBM Bob (unlimited usage). The specs must be self contained.
- Target is JLPT N3 (~650 kanji, ~3,600 vocab, ~26 levels).
- One user, personal use, Windows development machine.

**Revision 2026-11-01.** The device target changed from "desktop browser first, phone later" to "Android phone first". What you need from the phone:
- A real installed app (sideloaded APK, no Play Store).
- Fully offline use (study with no signal).
- Review reminder notifications.
- Desktop and synced progress eventually, but not now.
- No backup for now (accepted risk).

At the time of the revision only the Next.js scaffold and tooling existed. No feature code had been built, so the cost of changing the shell was close to zero.

> ⚠️ Premise note: "React Native" was the starting idea, and it fits. But the goals (offline, installed icon, reminders) could mostly be met by a PWA (an installable web app) too. A PWA was considered below. The native route wins here because Android's handling of PWA background notifications and long term offline storage is less dependable than a native app's, and those are the two things that keep a study habit alive. The cost you accept is a heavier toolchain.

## Options considered

### Option 1: Next.js + libSQL + Drizzle (original choice, 2026-10-13)
One TypeScript project for UI and server; SQLite file locally; hosted libSQL later by URL.
**Pros**: least setup, one command, agents are fluent in it.
**Cons**: needs a server to reach the phone, so offline is impossible without a rewrite; no real reminders.

### Option 2: Spring Boot + Angular + SQLite/Postgres
**Pros**: matches your work skills.
**Cons**: two projects, more boilerplate, and still no offline phone app.

### Option 3: Keep Next.js, add a PWA with offline storage
Make the web app installable, store progress in the browser (IndexedDB), host it, and sync later.
**Pros**: smallest change from the existing scaffold; one codebase for phone and desktop.
**Cons**: Android can evict browser storage, background notifications for PWAs are less dependable, and it still needs hosting to install at all.

### Option 4: Expo (React Native) Android app, local SQLite, no backend yet (chosen)
**Pros**: real APK, offline by design, local notifications with no server, the SQLite dialect matches a later D1 backend, Drizzle carries over from the old plan.
**Cons**: heavier toolchain (EAS, Maestro, `adb`); the Drizzle Expo driver was on pre release tags at check time; no desktop until later.

### Option 5: Expo universal app (Android + web) from day one
**Pros**: desktop comes almost free from the same screens.
**Cons**: `expo-sqlite` on the web was alpha at the time of the check and needs special browser headers; you chose phone first, so this is deferred, not rejected.

### Option 6: Monorepo with Expo (phone) plus Next.js (desktop)
**Pros**: each platform uses its natural framework.
**Cons**: every screen built twice; more config for one person.

### Sync options weighed (for later)
- **Own event log sync (chosen for later)**: reviews are append only events with UUIDs; replaying them through the pure SRS logic rebuilds state, so devices cannot conflict. Small, free, and it keeps the logic pure.
- **PowerSync**: a mature sync engine, but it needs Postgres and its own SQLite driver (`op-sqlite`), not `expo-sqlite`.
- **Turso offline sync**: same libSQL family, but in public beta with no automatic conflict resolution, and React Native support was unclear.
- **Supabase**: Postgres plus auth, but a different SQL dialect from the phone, and free projects pause after a week of inactivity.
- **Backend host for later: Cloudflare Worker + D1**: SQLite dialect (same as the phone), supported by Drizzle, free tier, no pausing. Runner up: Turso + a Worker (two vendors).

### Content options
- WaniKani API with your own token: rejected, needs a subscription, which defeats the goal.
- Runtime AI mnemonics: rejected, needs an API key, costs money, needs internet.
- No mnemonics: rejected, mnemonics are the core value. Kept a notes field as an override.
- Content on the phone: bundle the pipeline JSON and reseed on version change (chosen); a prebuilt `.db` file was the runner up (faster first launch, but a second database to manage); downloading on first run was rejected (breaks offline first launch).

## Rationale

The 2026-11-01 change follows the forces in Context. Offline study and reminders are the core of a daily SRS habit, and both need data and scheduling on the device. Option 4 puts everything on the phone with no server to run or pay for, matching "personal, free, offline". Expo gives a real APK through EAS Build without installing Android Studio on Windows, and Expo Go keeps the daily loop quick (basis: Expo local first guide). Drizzle with `expo-sqlite` keeps the typed schema and SQL migrations from the original plan (basis: Drizzle Expo SQLite docs). NativeWind keeps the Tailwind tokens and the installed tailwind skill (basis: your `AGENTS.md`, agent skills).

Phone first instead of universal (Option 5) was your call. It also avoids leaning on an alpha web SQLite layer now. The sync design is still settled ahead of time, because a review log with UUID ids and `updated_at` on notes costs nothing today and avoids a data migration later (basis: event sourcing; append only logs merge without conflicts).

Reminders use local notifications with inexact timing, because exact alarms on Android 14 need a permission that is denied by default, and a few minutes of slack does not matter for SRS hour buckets (basis: Expo Notifications docs). Maestro replaces Playwright because Playwright drives browsers, not Android apps.

Pure SRS, answer, and reminder modules exist because scheduling bugs silently ruin a study habit, so that logic must be unit tested in isolation.

Decisions made in the planning conversation (2026-10-13): content up to N3 only, mnemonics written by Bob as content files, Tracer Bullet build approach, Alpha workflow tier, original SRS stage names (Seed, Sprout, Bloom, Harvest, Retired).

Decisions made in the planning conversation (2026-11-01): Android phone first, desktop later; synced progress wanted eventually; fully offline; sideloaded APK only; Expo app at the repo root with a `sync/` folder added later; event log sync on a Cloudflare Worker + D1 with one sync token, deferred until desktop exists; no backup for now; EAS Build free tier for APKs; bundled content with reseed on version change; NativeWind; Maestro; both a daily summary and due time reminders.

## References

**Project sources**:
- `AGENTS.md` (ground rules, pure module rule, installed agent skills)
- `docs/scope/scope.md` (Tracer Bullet approach, deferred phone access)
- Specs 0002 to 0010 (built on this contract)

**Practices & standards**:
- Local first apps (data on the device, sync as an add on)
- Event sourcing with an append only log (conflict free merge by replay)
- Pure core, thin shell (logic without I/O, tested in isolation)

**Links** (web verified 2026-11-01):
- Expo SQLite docs: https://docs.expo.dev/versions/latest/sdk/sqlite/
- Expo local first guide: https://docs.expo.dev/guides/local-first/
- Expo Notifications docs: https://docs.expo.dev/versions/latest/sdk/notifications/
- Expo pricing (EAS free tier): https://expo.dev/pricing
- Drizzle with Expo SQLite: https://orm.drizzle.team/docs/connect-expo-sqlite
- PowerSync React Native and Expo SDK: https://docs.powersync.com/client-sdks/reference/react-native-and-expo
- Supabase pricing (free tier pause): https://supabase.com/pricing
