# AGENTS.md

Private, offline kanji SRS Android app built with Expo, installed as a sideloaded APK (radicals → kanji → vocabulary, JLPT N5 to N3). Built from free open data and original mnemonics.

**Read first:** [docs/scope/scope.md](docs/scope/scope.md) (what to build, in order) and [docs/specs/0001-kanji-srs-app/index.md](docs/specs/0001-kanji-srs-app/index.md) (the product contract). Each feature has its own spec in `docs/specs/` with a `## Build plan`. If code and a spec disagree, follow the spec and flag the difference. If a feature spec and 0001 disagree, 0001 wins.

## Stack

- **Language / Runtime**: TypeScript (strict); Node 22+ for the pipeline and tooling
- **Framework**: Expo SDK 58 with React Native 0.88 and React 19.3, Android only; Expo Router with routes in `src/app/`
- **Build and install**: EAS Build (`eas.json` profiles `preview` and `e2e`, both APK); project owner `edduenas-apps`, Android package `com.edduenas.kanjisrs`
- **Tooling installed**: ESLint (`eslint-config-expo` plus `eslint-config-prettier`), Prettier (`.prettierrc.json`, markdown and `docs/` ignored), Vitest (`vitest.config.mts`, tests in `src/**/*.test.ts`, `tests/unit/`, `pipeline/**/*.test.ts`), Husky plus lint-staged
- **Database**: `expo-sqlite` with Drizzle ORM 0.45 and drizzle-kit 0.31; Vitest runs the same schema and migrations on `better-sqlite3` in memory. See [src/lib/db/AGENTS.md](src/lib/db/AGENTS.md)
- **UI**: NativeWind 4.2 with Tailwind CSS 3.4 (`tailwind.config.js`, tokens in `src/global.css`), Reanimated 4.7, Noto Sans JP Regular and Bold via `expo-font`. See [src/theme/AGENTS.md](src/theme/AGENTS.md) and [src/components/ui/AGENTS.md](src/components/ui/AGENTS.md)
- **Study and pipeline libraries** (spec 0004): `wanakana` (romaji to kana in the reading field), `expo-crypto` (`randomUUID` for review ids); dev only `tsx` (runs `pipeline/src`) and `undici` (proxy aware downloads)
- **Speech** (spec 0009): `expo-speech` reads vocab readings aloud with an on device Japanese voice when one exists
- **Settings** (spec 0010): `@react-native-community/datetimepicker` (Android time dialog, also an `app.json` plugin)
- **Planned, not installed yet** (see 0001 `## Proposed stack`): `expo-notifications`, the Maestro CLI (flows are written in `maestro/`)
- **Package manager**: npm
- **Scripts that exist today**: `dev`, `android`, `lint`, `typecheck`, `format`, `format:check`, `test`, `doctor`, `db:generate`, `pipeline:download`, `pipeline:build`, `pipeline:bundle`, `pipeline:validate`, `pipeline:batch`, `pipeline:merge`
- **Pre-commit hook** (`.husky/pre-commit`): `lint-staged` (eslint + prettier on staged files), `npm run typecheck`, `npm test`

## Build approach

Tracer Bullet: get one thin real thread working through every layer first, then thicken one part at a time. Source: the header of [docs/scope/scope.md](docs/scope/scope.md).

## Tracker

Jira project `KS` (kanji-srs) on `vital-stats.atlassian.net`, [board 169](https://vital-stats.atlassian.net/jira/software/projects/KS/boards/169). It mirrors the scope: one Epic per phase, one Story per feature, one Subtask per scope box. Workflow transitions: To Do `11`, In Progress `21`, Done `31`. When a feature or box changes status in the scope, move its Jira issue to match.

## Git

When the owner says "commit" (or picks a commit option), commit and then push the branch to `origin`. A requested commit always ends pushed, even where a skill says it never pushes. Without that word, commit nothing and push nothing, and keep other sessions' uncommitted files out of a commit.

## Ground rules

1. **No WaniKani content, ever.** Do not scrape, copy, paraphrase, or import mnemonics, radical names, sentences, audio, or level lists from WaniKani or any paid course. Do not call the WaniKani API.
2. **No WaniKani name or logo.** The pink, blue, and purple colorway and a similar layout are allowed (owner's choice, 2026-11-01; see [docs/references/ui-inspiration.md](docs/references/ui-inspiration.md)). Use this app's own SRS stage names (Seed, Sprout, Bloom, Harvest, Retired).
3. **Mnemonics and radical names are original.** Invent them. Follow the writing rules in 0001 §5.4.
4. **Only the data sources in 0001 §5.1.** Record any new source and its license in `pipeline/raw/SOURCES.json` and on the Credits page.
5. **Keep `src/lib/srs` and `src/lib/answer` pure.** No DB, framework, `Date.now()`, or env access. Pass `now` in.
6. **Never write to content tables from app code.** Content only changes through the pipeline and the bundled content reseed on launch.
7. **Never renumber subject IDs.**
8. **Run `npm test` before every commit.** Do not commit failing tests.

## Commands (once set up)

```
npm run dev                 # expo start; scan the QR code with Expo Go (npx expo start --tunnel if the firewall blocks the phone)
npm test                    # Vitest
npx expo-doctor             # expect 20/20 (`npm run doctor` fails: expo-doctor is not a dependency)
npx eas-cli@latest build -p android --profile preview   # sideloadable APK on EAS (uses free build quota)
npm run test:e2e            # Maestro flows in maestro/
npm run pipeline:download   # fetch open data into pipeline/raw
npm run pipeline:build      # build content/subjects.json
npm run pipeline:bundle     # merge enabled levels and mnemonics into content/bundle.json and content-version.txt (the app reseeds on launch when it changes)
npm run pipeline:batch -- --levels 1-3   # write mnemonic batches to pipeline/work
npm run pipeline:merge      # validate + merge filled batches
npm run pipeline:validate   # content checks
npm run db:generate         # after a schema change: write a new SQL migration into drizzle/ (it runs on app launch)
```

Android emulator: follow [docs/references/android-emulator.md](docs/references/android-emulator.md) (boot `Medium_Phone_API_37.0` with `NO_PROXY` set for localhost, or it hangs `offline` behind the corporate proxy).

Keep `.easignore` in step with `.gitignore`: EAS reads it instead of `.gitignore`. It also keeps `.agents/`, `.bob/` and `.claude/` out of EAS uploads, because the symlinks in `.bob/skills/` make the upload fail on Windows (EPERM).

## Skills

Project skills live in `.bob/skills/`: `/scope` (what to build, `docs/scope/`), `/architect` (design specs, `docs/specs/`), `/develop` (build), `/check` (verify and review), `/test` (tests), `/sync` (keep AGENTS.md and scope current).

## Agent skills

- [tailwind-design-system](.agents/skills/tailwind-design-system/): `wshobson/agents`, Tailwind CSS design system and token conventions.
- [vercel-react-best-practices](.agents/skills/vercel-react-best-practices/): `vercel-labs/agent-skills`, React and Next.js performance and structure rules.
- [expo-overview](.agents/skills/expo-overview/): `expo/skills`, entry point for any Expo or EAS task; load first, it routes to the other expo skills.
- [expo-project-structure](.agents/skills/expo-project-structure/): `expo/skills`, folder layout for a new Expo Router app (scaffold time only).
- [expo-router](.agents/skills/expo-router/): `expo/skills`, file based routes, stacks, modals, headers.
- [expo-dev-client](.agents/skills/expo-dev-client/): `expo/skills`, development builds when Expo Go is not enough.
- [expo-upgrade](.agents/skills/expo-upgrade/): `expo/skills`, Expo SDK upgrades and dependency fixes.
- [expo-examples](.agents/skills/expo-examples/): `expo/skills`, official version matched integration examples (including SQLite) to adapt when adding a library.
- [vercel-react-native-skills](.agents/skills/vercel-react-native-skills/): `vercel-labs/agent-skills`, React Native performance and structure rules.
- [react-native-best-practices](.agents/skills/react-native-best-practices/): `callstackincubator/agent-skills`, React Native performance and best practices (Callstack).
- [limrun-maestro-testing](.agents/skills/limrun-maestro-testing/): `limrun-inc/skills`, Maestro end to end flows (community; check it does not assume the limrun cloud before relying on it).

MCP servers: maestro (recommended, `claude mcp add maestro -- maestro mcp`)
Declined: `honra-io/drizzle-best-practices` (PostgreSQL only; this app uses SQLite)
Declined: Agent Skill and MCP search for NativeWind and Reanimated (2026-11-02)

## Context files

- [src/lib/db/AGENTS.md](src/lib/db/AGENTS.md): database schema, migrations, transactions, and query rules
- [src/theme/AGENTS.md](src/theme/AGENTS.md): design tokens, raw colors, stage and progress helpers
- [src/components/ui/AGENTS.md](src/components/ui/AGENTS.md): base UI components and their accessibility rules
- [pipeline/AGENTS.md](pipeline/AGENTS.md): content pipeline steps, pinned sources, and the `content/` files
- [src/lib/study/AGENTS.md](src/lib/study/AGENTS.md): lesson and review services, the session queue, and the loop test
- [src/components/study/AGENTS.md](src/components/study/AGENTS.md): shared quiz and lesson screen pieces, leave guard, Maestro testIDs
- [src/components/home/AGENTS.md](src/components/home/AGENTS.md): Home dashboard cards (Next 24 hours, Level N, Stages) and forecast row labels
- [src/components/subject/AGENTS.md](src/components/subject/AGENTS.md): item page and level page pieces, notes and synonym editors, next review text, the speak button
- [src/components/settings/AGENTS.md](src/components/settings/AGENTS.md): Settings tab cards, stepper, time rows, skip ahead and reset dialogs, credit cards
