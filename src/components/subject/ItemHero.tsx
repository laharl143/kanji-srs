import { Text, View } from "react-native";

import { subjectBg, subjectLabel } from "@/components/study/subject-style";
import type { SubjectType } from "@/lib/types";
import { stageClasses, stageGroup } from "@/theme/stage";

// The type colored band at the top of an item page (spec 0009 AC-1).
export function ItemHero({
  type,
  level,
  characters,
  meaning,
}: {
  type: SubjectType;
  level: number;
  characters: string;
  meaning: string;
}) {
  return (
    <View
      testID="item-hero"
      className={`items-center gap-1 rounded-lg px-4 py-6 ${subjectBg[type]}`}
      accessible
      accessibilityLabel={`${subjectLabel[type]}, level ${level}, ${characters}, ${meaning}`}
    >
      <Text maxFontSizeMultiplier={1.3} className="text-sm font-bold uppercase text-white/90">
        {`${subjectLabel[type]} · Level ${level}`}
      </Text>
      <Text
        testID="item-characters"
        numberOfLines={1}
        adjustsFontSizeToFit
        maxFontSizeMultiplier={1.2}
        className="font-jp text-[72px] leading-[96px] text-white"
      >
        {characters}
      </Text>
      <Text className="text-center text-2xl font-bold text-white">{meaning}</Text>
    </View>
  );
}

// Stage label and the next review text, right under the hero (spec 0009 AC-1, AC-3).
export function StageStrip({ stage, next }: { stage: number | null; next: string }) {
  const { group, label } = stageGroup(stage);
  return (
    <View
      testID="item-stage"
      accessible
      accessibilityLabel={`Stage ${label}, next review ${next}`}
      className="flex-row items-center gap-3 rounded-lg bg-surface px-4 py-3 shadow-sm dark:border dark:border-border dark:shadow-none"
    >
      <View className={`h-3 w-3 rounded-full ${stageClasses[group].bg}`} />
      <Text className="flex-1 text-base font-bold text-text">{label}</Text>
      <Text className="text-sm text-muted">Next review</Text>
      <Text testID="item-next-review" className="text-base font-bold text-text">
        {next}
      </Text>
    </View>
  );
}
