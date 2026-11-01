import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { SubjectType } from "@/lib/types";
import { stageGroup } from "@/theme/stage";

import { StageDot } from "./StageDot";

type Size = "sm" | "md" | "lg";

type SubjectChipProps = {
  subject: { id: number; type: SubjectType; characters: string; meaning: string };
  // Omit to hide the stage; null means locked (no assignment).
  stage?: number | null;
  size?: Size;
  onPress?: () => void;
};

const typeClasses: Record<SubjectType, string> = {
  radical: "bg-radical",
  kanji: "bg-kanji",
  vocab: "bg-vocab",
};

const tileClasses: Record<Size, string> = {
  sm: "min-h-12 min-w-12 px-2",
  md: "min-h-16 min-w-16 px-3",
  lg: "min-h-24 min-w-24 px-4",
};

const textClasses: Record<Size, string> = {
  sm: "text-2xl",
  // An explicit line height; without one Noto Sans JP's tall line box stretches the tile.
  md: "text-[32px] leading-10",
  lg: "text-5xl",
};

export function SubjectChip({ subject, stage, size = "md", onPress }: SubjectChipProps) {
  const router = useRouter();
  const locked = stage === null;
  const label =
    `${subject.type} ${subject.characters}, ${subject.meaning}` +
    (stage !== undefined ? `, ${stageGroup(stage).label}` : "");

  function open() {
    router.push({ pathname: "/subjects/[id]", params: { id: String(subject.id) } });
  }

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress ?? open}
      className={`items-center justify-center rounded-md active:opacity-85 ${tileClasses[size]} ${locked ? "bg-stage-locked" : typeClasses[subject.type]}`}
    >
      {stage !== undefined && (
        <View className="absolute left-1 top-1">
          <StageDot stage={stage} size={8} />
        </View>
      )}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        maxFontSizeMultiplier={1.5}
        className={`font-jp ${textClasses[size]} ${locked ? "text-muted" : "text-white"}`}
      >
        {subject.characters}
      </Text>
    </Pressable>
  );
}
