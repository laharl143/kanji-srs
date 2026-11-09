import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { Card } from "@/components/ui";

// One titled card on the Settings tab (spec 0010 AC-1).
export function SettingsCard({
  title,
  children,
  testID,
}: {
  title: string;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <View testID={testID}>
      <Card>
        <Text accessibilityRole="header" className="text-lg font-bold text-text">
          {title}
        </Text>
        <View className="gap-3">{children}</View>
      </Card>
    </View>
  );
}
