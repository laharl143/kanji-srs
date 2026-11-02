import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { white } from "@/theme/colors";

// The subset of header props both the root Stack and the Tabs pass to `header`. Only stack
// screens pushed on top of another screen get `back`.
type AppBarProps = {
  options: {
    title?: string;
    headerRight?: (props: { tintColor?: string; canGoBack: boolean }) => ReactNode;
  };
  route: { name: string };
  navigation: { goBack: () => void };
  back?: { title: string | undefined };
};

// Solid pink bar drawn behind the status bar: white title, optional back arrow and right slot.
export function AppBar({ options, route, navigation, back }: AppBarProps) {
  const insets = useSafeAreaInsets();
  const title = options.title ?? route.name;
  const right = options.headerRight?.({ tintColor: white, canGoBack: back !== undefined });

  return (
    <View className="bg-appbar" style={{ paddingTop: insets.top }}>
      <View
        className="h-14 flex-row items-center gap-1"
        style={{ paddingLeft: insets.left + (back ? 4 : 16), paddingRight: insets.right + 8 }}
      >
        {back && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => navigation.goBack()}
            className="h-12 w-12 items-center justify-center rounded-full active:bg-white/20"
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={white} />
          </Pressable>
        )}
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
          className="flex-1 text-xl font-bold text-white"
        >
          {title}
        </Text>
        {right}
      </View>
    </View>
  );
}
