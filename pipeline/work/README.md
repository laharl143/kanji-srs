# Mnemonic batches

Batches in progress live here. Everything in this folder is gitignored except this README; merged batches move to `merged/`. Spec: [0005 full content pipeline](../../docs/specs/0005-content-pipeline/index.md). Writing rules: [0001 §5.4](../../docs/specs/0001-kanji-srs-app/index.md).

## The loop (Claude Code writes, you review the diff)

1. `npm run pipeline:batch -- --levels 2-3` writes `batch-NNN.json` files: at most 25 items of one type, only items with no mnemonic yet, radicals before kanji before vocab. It prints what it left out: a kanji waits until all its radicals have names, and a vocab until all its kanji are written.
2. In a Claude Code session, fill each item's empty fields in place:
   - radical: `name` (1 to 3 English words, original, unique across all radicals) and `meaningMnemonic` (1 to 3 sentences tying the shape to the name)
   - kanji: `meaningMnemonic` (a short story that names every radical in `radicals` and ends at the primary meaning), `readingMnemonic` (uses the hook at the start of a word, for example "Cook sounds like こく."), and `soundHook.hook` when it is empty (one lowercase English word that sounds like the reading, used by no other reading). Never change a prefilled hook.
   - vocab: `readingMnemonic` (1 to 2 sentences: how the meaning follows from the kanji and which reading is used, noting rendaku or irregular readings). `meaningMnemonic` is optional. Reuse the kanji `hook` when it helps.
   - Leave every other field as it is. All text is original: nothing from WaniKani or any other course, book, or site.
3. `npm run pipeline:merge` checks each filled batch and merges it into `content/mnemonics/*.json` and `sound-hooks.json`. A batch with any failure merges nothing: its failures print, it stays here, and you fix it and run merge again. An untouched batch is skipped. Running merge again is safe.
4. Repeat from step 1 until the levels have no items left (three rounds per level: radicals, kanji, vocab).
5. `npm run pipeline:validate` shows failures, warnings, and how much of each level is written.
6. When a level is fully written, add it to `content/enabled-levels.json` by hand, then run `npm run pipeline:bundle` and commit the content files together.
