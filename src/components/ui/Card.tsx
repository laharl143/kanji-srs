import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

// A pressable card needs a TalkBack label: a title, an accessibilityLabel, or both.
type CardProps = { children?: ReactNode } & (
  | { onPress?: undefined; title?: string; accessibilityLabel?: string }
  | { onPress: () => void; title: string; accessibilityLabel?: string }
  | { onPress: () => void; title?: string; accessibilityLabel: string }
);

const base =
  "gap-2 rounded-lg bg-surface p-4 shadow-sm dark:border dark:border-border dark:shadow-none";

export function Card({ title, children, onPress, accessibilityLabel }: CardProps) {
  const body = (
    <>
      {title && <Text className="text-lg font-bold text-text">{title}</Text>}
      {children}
    </>
  );

  if (!onPress) return <View className={base}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      className={`min-h-12 active:opacity-85 ${base}`}
    >
      {body}
    </Pressable>
  );
}
