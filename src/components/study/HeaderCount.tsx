import { Text, View } from "react-native";

type HeaderCountProps = {
  remaining: number;
  // Reviews only (spec 0006 AC-8): a whole percent, null until the first answer.
  accuracy?: number | null;
  testID?: string;
};

// The app bar pill during a session: "N left" (spec 0004 AC-8), with the review accuracy next to
// it once there is one. TalkBack reads both numbers as one label.
export function HeaderCount({ remaining, accuracy = null, testID }: HeaderCountProps) {
  const left = `${remaining} ${remaining === 1 ? "item" : "items"} left`;
  return (
    <View
      className="flex-row items-center gap-2 rounded-full bg-white/20 px-3 py-1"
      accessible
      accessibilityLabel={accuracy === null ? left : `${left}, accuracy ${accuracy} percent`}
    >
      {accuracy !== null ? (
        <>
          <Text
            testID="session-accuracy"
            maxFontSizeMultiplier={1.3}
            className="text-base font-bold text-white"
          >
            {accuracy}%
          </Text>
          <View className="h-4 w-px bg-white/40" />
        </>
      ) : null}
      <Text testID={testID} maxFontSizeMultiplier={1.3} className="text-base font-bold text-white">
        {remaining} left
      </Text>
    </View>
  );
}
