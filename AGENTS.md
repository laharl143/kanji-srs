# AGENTS.md

Private, local kanji SRS web app (radicals → kanji → vocabulary, JLPT N5 to N3). Built from free open data and original mnemonics.

**Read first:** [docs/superpowers/specs/2026-10-13-kanji-srs-design.md](docs/superpowers/specs/2026-10-13-kanji-srs-design.md). It is the source of truth. If the code and the spec disagree, follow the spec and flag the difference.

## Ground rules

1. **No WaniKani content, ever.** Do not scrape, copy, paraphrase, or import mnemonics, radical names, sentences, audio, or level lists from WaniKani or any paid course. Do not call the WaniKani API.
2. **No WaniKani branding.** Not the name, logo, colors, or UI. Use this app's own SRS stage names (Seed, Sprout, Bloom, Harvest, Retired).
3. **Mnemonics and radical names are original.** Invent them. Follow the writing rules in spec §5.4.
4. **Only the data sources in spec §5.1.** Record any new source and its license in `pipeline/raw/SOURCES.json` and on the Credits page.
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
