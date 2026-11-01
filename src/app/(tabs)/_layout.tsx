import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Text, type ColorValue } from "react-native";
import { Tabs } from "expo-router/js-tabs";

import { AppBar } from "@/components/ui";
import { usePalette } from "@/theme/use-palette";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

function tab(title: string, label: string, icon: IconName) {
  return {
    title,
    tabBarIcon: ({ color, size }: { color: ColorValue; size: number }) => (
      <MaterialCommunityIcons
        name={icon}
        color={typeof color === "string" ? color : undefined}
        size={size}
      />
    ),
    tabBarLabel: ({ color }: { color: ColorValue }) => (
      <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={{ color, fontSize: 12 }}>
        {label}
      </Text>
    ),
  };
}

export default function TabsLayout() {
  const palette = usePalette();
  return (
    <Tabs
      screenOptions={{
        header: (props) => <AppBar {...props} />,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: { backgroundColor: palette.surface, borderTopColor: palette.border },
      }}
    >
      <Tabs.Screen name="index" options={tab("Kanji SRS", "Home", "home")} />
      <Tabs.Screen name="levels" options={tab("Levels", "Levels", "view-grid")} />
      <Tabs.Screen name="settings" options={tab("Settings", "Settings", "cog")} />
    </Tabs>
  );
}
