import { Text, View } from "react-native";

// The "N left" pill in the app bar during a session (spec 0004 AC-8).
export function HeaderCount({ remaining, testID }: { remaining: number; testID?: string }) {
  return (
    <View
      className="rounded-full bg-white/20 px-3 py-1"
      accessible
      accessibilityLabel={`${remaining} ${remaining === 1 ? "item" : "items"} left`}
    >
      <Text testID={testID} maxFontSizeMultiplier={1.3} className="text-base font-bold text-white">
        {remaining} left
      </Text>
    </View>
  );
}
