import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Pressable } from "react-native";

import { usePalette } from "@/theme/use-palette";

import { useJapaneseVoice } from "./use-japanese-voice";

/**
 * Speaks a vocab reading in kana with the device's Japanese voice (spec 0009 AC-10). Hidden
 * until a Japanese voice is found, and for good when there is none. Tapping while it speaks
 * restarts it; leaving the screen stops it.
 */
export function SpeakButton({ text }: { text: string | undefined }) {
  const palette = usePalette();
  const voice = useJapaneseVoice();

  useFocusEffect(
    useCallback(() => {
      return () => {
        void Speech.stop();
      };
    }, []),
  );

  if (!voice || !text) return null;

  function play() {
    void Speech.stop().finally(() => Speech.speak(text!, { language: "ja-JP", voice: voice! }));
  }

  return (
    <Pressable
      testID="speak-reading"
      accessibilityRole="button"
      accessibilityLabel={`Play reading ${text}`}
      onPress={play}
      className="h-12 w-12 items-center justify-center rounded-full bg-primary active:opacity-85"
    >
      <MaterialCommunityIcons name="volume-high" size={24} color={palette["on-primary"]} />
    </Pressable>
  );
}
