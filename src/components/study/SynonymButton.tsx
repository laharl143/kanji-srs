import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable } from "react-native";

import { white } from "@/theme/colors";

// The top bar button that opens the synonym sheet during a question (spec 0011 AC-3), 48dp.
export function SynonymButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add a synonym for this item"
      testID="session-add-synonym"
      onPress={onPress}
      hitSlop={4}
      className="h-12 w-12 items-center justify-center rounded-full active:bg-white/20"
    >
      <MaterialCommunityIcons name="tag-plus" size={24} color={white} />
    </Pressable>
  );
}
