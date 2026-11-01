import { Text, View } from "react-native";

import { progressFraction } from "@/theme/progress";

type Color = "primary" | "radical" | "kanji" | "vocab";

type ProgressBarProps = {
  value: number;
  max: number;
  // A tick at this fraction (0 to 1), such as the 90% level up mark.
  marker?: number;
  color?: Color;
  label?: string;
};

const fillClasses: Record<Color, string> = {
  primary: "bg-primary",
  radical: "bg-radical",
  kanji: "bg-kanji",
  vocab: "bg-vocab",
};

export function ProgressBar({ value, max, marker, color = "primary", label }: ProgressBarProps) {
  const fraction = progressFraction(value, max);
  const top = Math.max(max, 0);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: top, now: fraction * top }}
      className="gap-1"
    >
      {label && <Text className="text-sm text-muted">{label}</Text>}
      <View className="h-2 overflow-hidden rounded-full bg-border">
        <View
          className={`h-full rounded-full ${fillClasses[color]}`}
          style={{ width: `${fraction * 100}%` }}
        />
        {marker !== undefined && (
          <View
            className="absolute bottom-0 top-0 w-0.5 bg-text"
            style={{ left: `${Math.min(Math.max(marker, 0), 1) * 100}%` }}
          />
        )}
      </View>
    </View>
  );
}
