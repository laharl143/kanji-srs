import { Text, View } from "react-native";

import type { QuestionKind } from "@/lib/study/queue";
import type { SubjectType } from "@/lib/types";

import { subjectBg, subjectLabel } from "./subject-style";

type PromptBandProps = {
  type: SubjectType;
  characters: string;
  kind: QuestionKind;
};

// The question: the characters large on the subject color, the type badge, and a strip that
// says Meaning or Reading (spec 0004 AC-10). The reading strip is inverted so the two never
// look alike at a glance.
export function PromptBand({ type, characters, kind }: PromptBandProps) {
  const reading = kind === "reading";
  const label = reading ? "Reading" : type === "radical" ? "Meaning (radical name)" : "Meaning";

  return (
    <View
      className="overflow-hidden rounded-lg"
      accessible
      accessibilityLabel={`${subjectLabel[type]} ${characters}. ${label}`}
    >
      <View className={`min-h-48 items-center justify-center px-4 py-6 ${subjectBg[type]}`}>
        <View className="absolute left-3 top-3 rounded-full bg-black/20 px-3 py-1">
          <Text maxFontSizeMultiplier={1.3} className="text-sm font-bold text-white">
            {subjectLabel[type]}
          </Text>
        </View>
        <Text
          testID="prompt-characters"
          numberOfLines={1}
          adjustsFontSizeToFit
          maxFontSizeMultiplier={1.2}
          className="font-jp text-[72px] leading-[96px] text-white"
        >
          {characters}
        </Text>
      </View>
      <View className={`items-center py-2 ${reading ? "bg-text" : "bg-surface"}`}>
        <Text
          testID="prompt-kind"
          maxFontSizeMultiplier={1.3}
          className={`text-base font-bold uppercase tracking-widest ${reading ? "text-bg" : "text-text"}`}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}
