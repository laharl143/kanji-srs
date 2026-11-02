// Pinned download sources (spec 0004 AC-1, AC-2). Changing a pin changes the content, so bump it
// on purpose and rebuild.

export const RAW_DIR = "pipeline/raw";

// jmdict-simplified repackages the EDRDG files as JSON under the same CC BY-SA 4.0 license.
export const JMDICT_SIMPLIFIED_TAG = "3.6.2+20261026175559";
const JMDICT_SIMPLIFIED_BASE = `https://github.com/scriptin/jmdict-simplified/releases/download/${encodeURIComponent(JMDICT_SIMPLIFIED_TAG)}`;
const EDRDG_LICENSE =
  "CC BY-SA 4.0 (EDRDG, https://www.edrdg.org/edrdg/licence.html), JSON by jmdict-simplified";

// tanos license, read from https://www.tanos.co.uk/jlpt/sharing/ and confirmed by the owner on
// 2026-11-02. Anything but "usable" makes the build fall back to KANJIDIC2 old JLPT levels.
export const tanosLicense: "usable" | "unusable" | "unconfirmed" = "usable";
export const TANOS_LICENSE_TEXT =
  'Creative Commons "BY": "Everything on this site (that I\'m not selling), is licenced under ' +
  'Creative Commons "BY"." Credit: Jonathan Waller, https://www.tanos.co.uk/jlpt/';

export type Source = {
  // File name inside RAW_DIR.
  file: string;
  url: string;
  // Where the file really comes from, when `url` is a mirror.
  origin?: string;
  license: string;
  // A .tgz holding one JSON file, unpacked to `file` without the .tgz suffix.
  unpack?: "tgz";
};

function jmdictAsset(name: string): Source {
  const asset = `${name}-${JMDICT_SIMPLIFIED_TAG}.json.tgz`;
  return {
    file: `${name}.json.tgz`,
    url: `${JMDICT_SIMPLIFIED_BASE}/${encodeURIComponent(asset)}`,
    license: EDRDG_LICENSE,
    unpack: "tgz",
  };
}

// The corporate proxy blocks tanos.co.uk, so these are Internet Archive snapshots of the exact
// files (owner's choice, 2026-11-02). `origin` keeps the real tanos URL for the Credits page.
const TANOS_SNAPSHOTS: Record<string, string> = {
  "jlpt5/kanji/n5-kanji-char-eng.anki": "20251115051142",
  "jlpt5/vocab/n5-vocab-kanji-hiragana.anki": "20250512053204",
  "jlpt4/kanji/n4-kanji-char-eng.anki": "20251116015428",
  "jlpt4/vocab/n4-vocab-kanji-hiragana.anki": "20250819194120",
  "jlpt3/kanji/n3-kanji-char-eng.anki": "20251114201814",
  // The 2021+ version of this deck is a corrupt SQLite file ("invalid rootpage"), so this pins
  // the last snapshot of the earlier version, which opens cleanly.
  "jlpt3/vocab/n3-vocab-kanji-hiragana.anki": "20200706172417",
};

function tanosAsset(path: string): Source {
  const origin = `https://www.tanos.co.uk/jlpt/${path}`;
  return {
    file: `tanos-${path.split("/").pop()}`,
    url: `https://web.archive.org/web/${TANOS_SNAPSHOTS[path]}id_/${origin}`,
    origin,
    license: TANOS_LICENSE_TEXT,
  };
}

export const SOURCES: Source[] = [
  jmdictAsset("jmdict-eng"),
  jmdictAsset("kanjidic2-en"),
  jmdictAsset("kradfile"),
  ...Object.keys(TANOS_SNAPSHOTS).map(tanosAsset),
];

// Unpacked file names the parsers read.
export const RAW = {
  jmdict: "jmdict-eng.json",
  kanjidic: "kanjidic2-en.json",
  kradfile: "kradfile.json",
  tanosKanji: (n: 5 | 4 | 3) => `tanos-n${n}-kanji-char-eng.anki`,
  tanosVocab: (n: 5 | 4 | 3) => `tanos-n${n}-vocab-kanji-hiragana.anki`,
};
