# 0001. Rationale

## Context

You want a WaniKani-style kanji course without the monthly subscription. Copying WaniKani content (scraping or the API) is off the table: it is the paid product, and the API needs a subscription past level 3. So the app must be built from free, openly licensed data plus original mnemonics.

Constraints that shaped the design:
- Planning happens in Claude Code; building happens in IBM Bob (unlimited usage). The specs must be self contained.
- Desktop browser first, phone later, so the data layer must be able to move to a hosted database without a rewrite.
- Target is JLPT N3 (~650 kanji, ~3,600 vocab, ~26 levels).
- One user, personal use, Windows machine.

## Options considered

### Option 1: Next.js + libSQL + Drizzle (chosen)
One TypeScript project for UI and server; SQLite file locally; hosted libSQL later by URL.
**Pros**: least setup, one command, agents are fluent in it, clean phone upgrade path.
**Cons**: not your day job stack (Java/Angular).

### Option 2: Spring Boot + Angular + SQLite/Postgres
**Pros**: matches your work skills.
**Cons**: two projects, more boilerplate, heavier deploy when the phone comes.

### Option 3: Vite + React, browser only (IndexedDB)
**Pros**: lightest; no server.
**Cons**: data trapped in one browser; phone sync later is the hardest of the three.

### Content options
- WaniKani API with your own token: rejected, needs a subscription, which defeats the goal.
- Runtime AI mnemonics: rejected, needs an API key, costs money, needs internet.
- No mnemonics: rejected, mnemonics are the core value. Kept a notes field as an override.

## Rationale

Option 1 trades familiarity for speed, and speed matters more for a solo side project built by an AI agent. libSQL keeps the "phone later" door open with a URL change. Content written by Bob ahead of time keeps the app offline and free. Pure SRS and answer modules exist because scheduling bugs silently ruin a study habit, so that logic must be unit tested in isolation.

Decisions made in the planning conversation (2026-10-13): device scope C (desktop now, phone later), content up to N3 only, mnemonics written by Bob as content files, Next.js for speed, Tracer Bullet build approach, Alpha workflow tier, original SRS stage names (Seed, Sprout, Bloom, Harvest, Retired).
