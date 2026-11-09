// The Credits screen (spec 0010 AC-10). Hand typed, so names and links read well. Each entry
// names, in `sourceFiles`, the files of the pipeline's SOURCES list (pipeline/src/sources.ts) it
// covers; credits.test.ts fails when a source is added there but not credited here. Ground rule
// 4: a new data source goes into both places.

export type CreditLink = { label: string; url: string };

export type Credit = {
  id: string;
  // What the entry is, e.g. "Dictionary data".
  heading: string;
  title: string;
  by: string;
  // The license name, as it appears in the matching SOURCES entries.
  license: string;
  note?: string;
  links: CreditLink[];
  sourceFiles: string[];
};

const ADAPTED = "Adapted: converted to JSON and filtered to the words and kanji this app teaches";

const CC_BY_SA: CreditLink = {
  label: "CC BY-SA 4.0 license",
  url: "https://creativecommons.org/licenses/by-sa/4.0/",
};

const TANOS_FILES = [
  "tanos-n5-kanji-char-eng.anki",
  "tanos-n5-vocab-kanji-hiragana.anki",
  "tanos-n4-kanji-char-eng.anki",
  "tanos-n4-vocab-kanji-hiragana.anki",
  "tanos-n3-kanji-char-eng.anki",
  "tanos-n3-vocab-kanji-hiragana.anki",
];

export const CREDITS: Credit[] = [
  {
    id: "edrdg",
    heading: "Dictionary data",
    title: "JMdict, KANJIDIC2, and KRADFILE",
    by: "Electronic Dictionary Research and Development Group",
    license: "CC BY-SA 4.0",
    note: ADAPTED,
    links: [{ label: "EDRDG license", url: "https://www.edrdg.org/edrdg/licence.html" }, CC_BY_SA],
    sourceFiles: ["jmdict-eng.json.tgz", "kanjidic2-en.json.tgz", "kradfile.json.tgz"],
  },
  {
    id: "jmdict-simplified",
    heading: "JSON conversion",
    title: "jmdict-simplified",
    by: "scriptin",
    license: "CC BY-SA 4.0",
    links: [{ label: "Source", url: "https://github.com/scriptin/jmdict-simplified" }, CC_BY_SA],
    sourceFiles: ["jmdict-eng.json.tgz", "kanjidic2-en.json.tgz", "kradfile.json.tgz"],
  },
  {
    id: "tanos",
    heading: "JLPT lists",
    title: "JLPT N5 to N3 kanji and vocab lists",
    by: "Jonathan Waller (tanos.co.uk)",
    license: "Creative Commons BY",
    note: ADAPTED,
    links: [
      { label: "Source", url: "https://www.tanos.co.uk/jlpt/" },
      { label: "CC BY 4.0 license", url: "https://creativecommons.org/licenses/by/4.0/" },
    ],
    sourceFiles: TANOS_FILES,
  },
  {
    id: "noto-sans-jp",
    heading: "Font",
    title: "Noto Sans JP",
    by: "Copyright 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'",
    license: "SIL Open Font License 1.1",
    links: [
      { label: "Source", url: "https://fonts.google.com/noto/specimen/Noto+Sans+JP" },
      { label: "OFL 1.1 license", url: "https://openfontlicense.org/" },
    ],
    sourceFiles: [],
  },
  {
    id: "mdi",
    heading: "Icons",
    title: "Material Design Icons",
    by: "Pictogrammers",
    license: "Apache License 2.0",
    links: [
      { label: "Source", url: "https://github.com/Templarian/MaterialDesign" },
      { label: "Apache 2.0 license", url: "https://www.apache.org/licenses/LICENSE-2.0" },
    ],
    sourceFiles: [],
  },
];

export const CREDITS_CLOSING = "Radical names and mnemonics are original to this app.";
