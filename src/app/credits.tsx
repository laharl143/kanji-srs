import { Stack } from "expo-router";
import { Text } from "react-native";

import { CreditCard } from "@/components/settings";
import { Screen } from "@/components/ui";
import { CREDITS, CREDITS_CLOSING } from "@/lib/credits";

// Credits and licenses (spec 0010 AC-10), pushed from Settings.
export default function CreditsScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: "Credits" }} />
      {CREDITS.map((credit) => (
        <CreditCard key={credit.id} credit={credit} />
      ))}
      <Text className="px-1 text-base text-muted">{CREDITS_CLOSING}</Text>
    </Screen>
  );
}
