import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { Button, Card } from "@/components/ui";
import { usePalette } from "@/theme/use-palette";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type MessageCardProps = {
  icon: IconName;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  testID?: string;
  secondary?: { label: string; onPress: () => void };
  actionIcon?: IconName;
  actionTestID?: string;
};

// A centered card with an icon, a message, and one main action: empty, done, and error states.
export function MessageCard({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  testID,
  secondary,
  actionIcon = "home",
  actionTestID = "session-home",
}: MessageCardProps) {
  const palette = usePalette();
  return (
    <Card>
      <View className="items-center gap-3 py-4" testID={testID}>
        <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <MaterialCommunityIcons name={icon} size={32} color={palette.primary} />
        </View>
        <Text accessibilityRole="header" className="text-center text-xl font-bold text-text">
          {title}
        </Text>
        <Text className="text-center text-base text-muted">{body}</Text>
      </View>
      <View className="gap-2">
        <Button label={actionLabel} icon={actionIcon} testID={actionTestID} onPress={onAction} />
        {secondary && (
          <Button label={secondary.label} variant="secondary" onPress={secondary.onPress} />
        )}
      </View>
    </Card>
  );
}

export function LoadingState({ label }: { label: string }) {
  const palette = usePalette();
  return (
    <View
      className="flex-1 items-center justify-center gap-3 py-16"
      accessible
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
    >
      <ActivityIndicator size="large" color={palette.primary} />
      <Text className="text-base text-muted">{label}</Text>
    </View>
  );
}

// "Done, N items" (spec 0004 AC-10).
export function DoneCard({ count, onHome }: { count: number; onHome: () => void }) {
  return (
    <MessageCard
      icon="check-decagram"
      title={`Done, ${count} ${count === 1 ? "item" : "items"}`}
      body="Your progress is saved. Each item comes back for review when it is due."
      actionLabel="Home"
      onAction={onHome}
      testID="session-done"
    />
  );
}
