import { View } from "react-native";

import { stageClasses, stageGroup } from "@/theme/stage";

type StageDotProps = { stage: number | null; size?: number };

// Color only; the caller always puts the stage label in text or in its accessibility label.
export function StageDot({ stage, size = 10 }: StageDotProps) {
  const { group } = stageGroup(stage);
  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      className={`rounded-full ${stageClasses[group].bg}`}
      style={{ width: size, height: size }}
    />
  );
}
