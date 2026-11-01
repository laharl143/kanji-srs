import { Stack, useLocalSearchParams } from "expo-router";
import { Text } from "react-native";

import { Screen } from "@/components/ui";

// Placeholder so SubjectChip links resolve; spec 0009 builds the real item page.
export default function SubjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen>
      <Stack.Screen options={{ title: "Item" }} />
      <Text className="text-base text-text">Item {id}</Text>
    </Screen>
  );
}
