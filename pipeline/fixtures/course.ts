// A small course for the batch and merge tests: level 1 is written and enabled, levels 2 and 3
// are not written yet.
import type { ContentSubject } from "../../src/lib/content/types";
import type { SubjectType } from "../../src/lib/types";
import type { Content } from "../src/content";

type Options = {
  components?: number[];
  readings?: ContentSubject["readings"];
  meanings?: string[];
};

export function subject(
  id: number,
  type: SubjectType,
  characters: string,
  level: number,
  position: number,
  {
    components = [],
    readings = [],
    meanings = type === "radical" ? [] : [characters],
  }: Options = {},
): ContentSubject {
  return {
    id,
    type,
    characters,
    level,
    position,
    meanings: meanings.map((text, i) => ({ text, primary: i === 0 })),
    readings,
    componentIds: components,
    jlpt: type === "radical" ? null : 5,
    frequency: null,
  };
}

export const on = (text: string, primary = true) => ({ text, kind: "onyomi" as const, primary });
export const kun = (text: string, primary = false) => ({ text, kind: "kunyomi" as const, primary });
const word = (text: string) => [{ text, primary: true }];

export function course(): Content {
  return {
    subjects: [
      subject(1, "radical", "一", 1, 1),
      subject(2, "radical", "卜", 1, 2),
      subject(3, "kanji", "上", 1, 1, {
        components: [1, 2],
        readings: [on("じょう"), kun("うえ")],
        meanings: ["above", "up"],
      }),
      subject(4, "vocab", "上", 1, 1, {
        components: [3],
        readings: word("うえ"),
        meanings: ["above"],
      }),
      subject(5, "radical", "口", 2, 1),
      subject(6, "radical", "丨", 2, 2),
      subject(7, "kanji", "中", 2, 1, {
        components: [5, 6],
        readings: [on("ちゅう"), kun("なか")],
        meanings: ["middle", "in"],
      }),
      subject(8, "kanji", "下", 2, 2, {
        components: [1, 2],
        readings: [on("か"), on("げ"), kun("した")],
        meanings: ["below", "down"],
      }),
      subject(9, "vocab", "中", 2, 1, {
        components: [7],
        readings: word("なか"),
        meanings: ["inside"],
      }),
      subject(10, "vocab", "上下", 2, 2, {
        components: [3, 8],
        readings: word("じょうげ"),
        meanings: ["top and bottom"],
      }),
      subject(11, "radical", "木", 3, 1),
    ],
    mnemonics: {
      radicals: {
        一: { name: "plank", meaningMnemonic: "A plank." },
        卜: { name: "fortune stick", meaningMnemonic: "A stick." },
      },
      kanji: {
        上: {
          meaningMnemonic: "A fortune stick stands on a plank, pointing above.",
          readingMnemonic: "A joker juggles up above. Joker sounds like じょう.",
        },
      },
      vocab: { 上: { readingMnemonic: "Alone it uses the kun'yomi うえ." } },
    },
    soundHooks: { じょう: "joker" },
    enabledLevels: [1],
    shipped: [
      { id: 1, type: "radical", characters: "一" },
      { id: 2, type: "radical", characters: "卜" },
      { id: 3, type: "kanji", characters: "上" },
      { id: 4, type: "vocab", characters: "上" },
    ],
    retired: [],
  };
}
