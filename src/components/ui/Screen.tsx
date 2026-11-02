import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  // Tab screens pass false: the tab bar already pads the bottom inset.
  bottomInset?: boolean;
};

// Page wrapper: --bg background and the left, right, and bottom safe areas. The top inset
// belongs to AppBar.
export function Screen({
  children,
  scroll = true,
  padded = true,
  bottomInset = true,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const inset = {
    paddingLeft: insets.left,
    paddingRight: insets.right,
    paddingBottom: bottomInset ? insets.bottom : 0,
  };
  const content = padded ? "p-4 gap-4" : "";

  if (!scroll) {
    return (
      <View className="flex-1 bg-bg" style={inset}>
        <View className={`flex-1 ${content}`}>{children}</View>
      </View>
    );
  }
  return (
    <View className="flex-1 bg-bg" style={inset}>
      <ScrollView
        className="flex-1"
        contentContainerClassName={content}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}
