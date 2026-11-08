import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Platform, TextInput } from "react-native";

import { toReadingInput } from "@/lib/answer/kana";
import type { QuestionKind } from "@/lib/study/queue";
import { usePalette } from "@/theme/use-palette";

export type AnswerStatus = "idle" | "correct" | "close" | "wrong";

type AnswerInputProps = {
  kind: QuestionKind;
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  status: AnswerStatus;
  // Each change shakes the field (spec 0007 AC-8); 0 never shakes.
  shakeKey?: number;
  testID?: string;
};

const statusClasses: Record<AnswerStatus, string> = {
  idle: "border-border bg-surface",
  correct: "border-correct bg-correct/10",
  close: "border-correct bg-correct/10",
  wrong: "border-wrong bg-wrong/10",
};

const statusLabels: Record<AnswerStatus, string> = {
  idle: "",
  correct: ", correct",
  close: ", close enough",
  wrong: ", wrong",
};

// The system's remove animations setting, kept current.
function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => active && setReduce(on));
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

// About 300 ms side to side when `shakeKey` changes, unless remove animations is on.
function useShake(shakeKey: number, reduceMotion: boolean): Animated.Value {
  const [offset] = useState(() => new Animated.Value(0));
  const last = useRef(shakeKey);
  useEffect(() => {
    if (shakeKey === last.current) return;
    last.current = shakeKey;
    if (reduceMotion) return;
    const step = (toValue: number) =>
      Animated.timing(offset, { toValue, duration: 50, useNativeDriver: true });
    offset.setValue(0);
    Animated.sequence([step(-10), step(10), step(-8), step(8), step(-4), step(0)]).start();
  }, [shakeKey, reduceMotion, offset]);
  return offset;
}

/**
 * The one answer field for lessons and reviews. The keyboard's submit key calls `onSubmit` and
 * keeps the keyboard open, so a second press can move to the next question.
 */
export function AnswerInput({
  kind,
  value,
  onChangeText,
  onSubmit,
  status,
  shakeKey = 0,
  testID,
}: AnswerInputProps) {
  const palette = usePalette();
  const reading = kind === "reading";
  const offset = useShake(shakeKey, useReduceMotion());

  return (
    <Animated.View style={{ transform: [{ translateX: offset }] }}>
      <TextInput
        // A fresh field per kind: Android keeps the old keyboardType's variation bits when it
        // changes on a mounted field, so a reading question after a meaning one kept the password
        // keyboard.
        key={kind}
        testID={testID}
        value={value}
        onChangeText={(text) => onChangeText(reading ? toReadingInput(text) : text)}
        onSubmitEditing={onSubmit}
        submitBehavior="submit"
        returnKeyType={status === "idle" ? "done" : "next"}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        // Gboard ignores autoCorrect={false} (NO_SUGGESTIONS) and swaps a typo like "mnoth" for
        // "month" on Enter, so a Close enough answer was judged Correct (spec 0007 AC-2, AC-9). The
        // visible password variation turns its suggestions off. Meaning only: the reading field
        // keeps the default keyboard so a kana keyboard still works there.
        keyboardType={!reading && Platform.OS === "android" ? "visible-password" : "default"}
        autoComplete="off"
        spellCheck={false}
        // Short enough to fit on one line at 360dp with the largest font scale (1.4).
        placeholder={reading ? "Type the reading" : "Type the meaning"}
        placeholderTextColor={palette.muted}
        accessibilityLabel={`${reading ? "Reading" : "Meaning"} answer${statusLabels[status]}`}
        maxFontSizeMultiplier={1.4}
        // Android pads an empty field's line to the font's bounding box. Noto Sans JP's is over twice
        // the line height, so the placeholder got cut off (in either mode: the field can keep that
        // font after a reading question).
        style={{ includeFontPadding: false }}
        className={`min-h-14 rounded-md border-2 px-4 py-3 text-center text-2xl text-text ${reading ? "font-jp" : ""} ${statusClasses[status]}`}
      />
    </Animated.View>
  );
}
