import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { Chip } from "@/lib/study/items";
import { primaryMeaning } from "@/lib/subjects";
import { stageClasses, stageGroup } from "@/theme/stage";

import { subjectBg } from "@/components/study/subject-style";

// Full literal widths, so NativeWind sees them: 5 per row for radicals and kanji, 3 for vocab.
const widthClasses = { 5: "w-1/5", 3: "w-1/3" } as const;

/**
 * One level grid tile (spec 0009 AC-9): type color, characters, primary meaning on one line, and
 * a bar in the stage group color. No assignment: a grey tile with no bar. Reads as one label in
 * SubjectChip's format, for example "kanji 大, Large, Sprout".
 */
export function SubjectTile({ item, columns }: { item: Chip; columns: 5 | 3 }) {
  const router = useRouter();
  const meaning = primaryMeaning(item.meanings);
  const { group, label } = stageGroup(item.stage);
  const locked = item.stage === null;

  return (
    <View className={`p-1 ${widthClasses[columns]}`}>
      <Pressable
        testID={`tile-${item.id}`}
        accessibilityRole="link"
        accessibilityLabel={`${item.type} ${item.characters}, ${meaning}, ${label}`}
        onPress={() => router.push({ pathname: "/subjects/[id]", params: { id: String(item.id) } })}
        className={`min-h-16 overflow-hidden rounded-md active:opacity-85 ${locked ? "bg-stage-locked" : subjectBg[item.type]}`}
      >
        <View className="flex-1 items-center justify-center px-1 pb-2 pt-1">
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            maxFontSizeMultiplier={1.2}
            className={`font-jp text-2xl ${locked ? "text-muted" : "text-white"}`}
          >
            {item.characters}
          </Text>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            maxFontSizeMultiplier={1.2}
            className={`text-xs ${locked ? "text-muted" : "text-white"}`}
          >
            {meaning}
          </Text>
        </View>
        {!locked && (
          <View className={`absolute bottom-0 left-0 right-0 h-1.5 ${stageClasses[group].bg}`} />
        )}
      </Pressable>
    </View>
  );
}

const LEGEND = [null, 0, 1, 5, 7, 8, 9] as const;

// The seven states under the grids (spec 0009 AC-9).
export function StageLegend() {
  return (
    <View testID="stage-legend" className="flex-row flex-wrap gap-x-4 gap-y-2">
      {LEGEND.map((stage) => {
        const { group, label } = stageGroup(stage);
        return (
          <View key={group} className="flex-row items-center gap-2">
            <View className={`h-3 w-5 rounded-sm ${stageClasses[group].bg}`} />
            <Text className="text-sm text-text">{label}</Text>
          </View>
        );
      })}
    </View>
  );
}
