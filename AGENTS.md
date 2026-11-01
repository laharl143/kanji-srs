# AGENTS.md

Private, local kanji SRS web app (radicals → kanji → vocabulary, JLPT N5 to N3). Built from free open data and original mnemonics.

**Read first:** [docs/scope/scope.md](docs/scope/scope.md) (what to build, in order) and [docs/specs/0001-kanji-srs-app/index.md](docs/specs/0001-kanji-srs-app/index.md) (the product contract). Each feature has its own spec in `docs/specs/` with a `## Build plan`. If code and a spec disagree, follow the spec and flag the difference. If a feature spec and 0001 disagree, 0001 wins.

## Stack

- **Language / Runtime**: TypeScript on Node
- **Framework**: Next.js 16 (App Router), React 19, Tailwind CSS 4
- **Tooling installed**: ESLint (Next config plus `eslint-config-prettier`), Prettier (`.prettierrc.json`, markdown and `docs/` ignored), Vitest (`vitest.config.mts`, tests in `src/**/*.test.ts`, `tests/unit/`, `pipeline/**/*.test.ts`), Husky plus lint-staged
- **Planned, not installed yet** (see 0001 `## Proposed stack`): libSQL via `@libsql/client`, Drizzle ORM and drizzle-kit, Playwright
- **Package manager**: npm
- **Scripts that exist today**: `dev`, `build`, `start`, `lint`, `typecheck`, `format`, `format:check`, `test`
- **Pre-commit hook** (`.husky/pre-commit`): `lint-staged` (eslint + prettier on staged files), `npm run typecheck`, `npm test`

## Build approach

Tracer Bullet: get one thin real thread working through every layer first, then thicken one part at a time. Source: the header of [docs/scope/scope.md](docs/scope/scope.md).

## Ground rules

1. **No WaniKani content, ever.** Do not scrape, copy, paraphrase, or import mnemonics, radical names, sentences, audio, or level lists from WaniKani or any paid course. Do not call the WaniKani API.
2. **No WaniKani branding.** Not the name, logo, colors, or UI. Use this app's own SRS stage names (Seed, Sprout, Bloom, Harvest, Retired).
3. **Mnemonics and radical names are original.** Invent them. Follow the writing rules in 0001 §5.4.
4. **Only the data sources in 0001 §5.1.** Record any new source and its license in `pipeline/raw/SOURCES.json` and on the Credits page.
5. **Keep `src/lib/srs` and `src/lib/answer` pure.** No DB, framework, `Date.now()`, or env access. Pass `now` in.
6. **Never write to content tables from app code.** Content only changes through the pipeline + `npm run db:seed`.
7. **Never renumber subject IDs.**
8. **Run `npm test` before every commit.** Do not commit failing tests.

## Commands (once set up)

```
npm run dev                 # app at http://localhost:3000
npm test                    # Vitest
npm run test:e2e            # Playwright
npm run pipeline:download   # fetch open data into pipeline/raw
npm run pipeline:build      # build content/subjects.json
npm run pipeline:batch -- --levels 1-3   # write mnemonic batches to pipeline/work
npm run pipeline:merge      # validate + merge filled batches
npm run pipeline:validate   # content checks
npm run db:migrate
npm run db:seed
```

## Skills

Project skills live in `.bob/skills/`: `/scope` (what to build, `docs/scope/`), `/architect` (design specs, `docs/specs/`), `/develop` (build), `/check` (verify and review), `/test` (tests), `/sync` (keep AGENTS.md and scope current).

## Agent skills

- [tailwind-design-system](.agents/skills/tailwind-design-system/): `wshobson/agents`, Tailwind CSS design system and token conventions.
- [vercel-react-best-practices](.agents/skills/vercel-react-best-practices/): `vercel-labs/agent-skills`, React and Next.js performance and structure rules.
