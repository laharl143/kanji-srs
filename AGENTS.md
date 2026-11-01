# AGENTS.md

Private, offline kanji SRS Android app built with Expo, installed as a sideloaded APK (radicals → kanji → vocabulary, JLPT N5 to N3). Built from free open data and original mnemonics.

**Read first:** [docs/scope/scope.md](docs/scope/scope.md) (what to build, in order) and [docs/specs/0001-kanji-srs-app/index.md](docs/specs/0001-kanji-srs-app/index.md) (the product contract). Each feature has its own spec in `docs/specs/` with a `## Build plan`. If code and a spec disagree, follow the spec and flag the difference. If a feature spec and 0001 disagree, 0001 wins.

## Stack

- **Language / Runtime**: TypeScript (strict); Node 22+ for the pipeline and tooling
- **Framework**: Expo SDK 58 with React Native 0.88 and React 19.3, Android only; Expo Router with routes in `src/app/`
- **Build and install**: EAS Build (`eas.json` profiles `preview` and `e2e`, both APK); project owner `edduenas-apps`, Android package `com.edduenas.kanjisrs`
- **Tooling installed**: ESLint (`eslint-config-expo` plus `eslint-config-prettier`), Prettier (`.prettierrc.json`, markdown and `docs/` ignored), Vitest (`vitest.config.mts`, tests in `src/**/*.test.ts`, `tests/unit/`, `pipeline/**/*.test.ts`), Husky plus lint-staged
- **Database**: `expo-sqlite` with Drizzle ORM 0.45 and drizzle-kit 0.31; Vitest runs the same schema and migrations on `better-sqlite3` in memory. See [src/lib/db/AGENTS.md](src/lib/db/AGENTS.md)
- **Planned, not installed yet** (see 0001 `## Proposed stack`): NativeWind v4 (Tailwind CSS 3.4), `expo-notifications`, `expo-speech`, `wanakana`, Noto Sans JP via `expo-font`, Maestro
- **Package manager**: npm
- **Scripts that exist today**: `dev`, `android`, `lint`, `typecheck`, `format`, `format:check`, `test`, `doctor`, `db:generate`
- **Pre-commit hook** (`.husky/pre-commit`): `lint-staged` (eslint + prettier on staged files), `npm run typecheck`, `npm test`

## Build approach

Tracer Bullet: get one thin real thread working through every layer first, then thicken one part at a time. Source: the header of [docs/scope/scope.md](docs/scope/scope.md).

## Ground rules

1. **No WaniKani content, ever.** Do not scrape, copy, paraphrase, or import mnemonics, radical names, sentences, audio, or level lists from WaniKani or any paid course. Do not call the WaniKani API.
2. **No WaniKani branding.** Not the name, logo, colors, or UI. Use this app's own SRS stage names (Seed, Sprout, Bloom, Harvest, Retired).
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
npm run doctor              # expo-doctor, expect 20/20
npx eas-cli@latest build -p android --profile preview   # sideloadable APK on EAS (uses free build quota)
npm run test:e2e            # Maestro flows in maestro/
npm run pipeline:download   # fetch open data into pipeline/raw
npm run pipeline:build      # build content/subjects.json
npm run pipeline:batch -- --levels 1-3   # write mnemonic batches to pipeline/work
npm run pipeline:merge      # validate + merge filled batches
npm run pipeline:validate   # content checks
npm run db:generate         # after a schema change: write a new SQL migration into drizzle/ (it runs on app launch)
```

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

## Context files

- [src/lib/db/AGENTS.md](src/lib/db/AGENTS.md): database schema, migrations, transactions, and query rules
