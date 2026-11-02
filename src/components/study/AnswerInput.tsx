import { TextInput } from "react-native";

import { toReadingInput } from "@/lib/answer/kana";
import type { QuestionKind } from "@/lib/study/queue";
import { usePalette } from "@/theme/use-palette";

export type AnswerStatus = "idle" | "correct" | "wrong";

type AnswerInputProps = {
  kind: QuestionKind;
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  status: AnswerStatus;
  testID?: string;
};

const statusClasses: Record<AnswerStatus, string> = {
  idle: "border-border bg-surface",
  correct: "border-correct bg-correct/10",
  wrong: "border-wrong bg-wrong/10",
};

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
  testID,
}: AnswerInputProps) {
  const palette = usePalette();
  const reading = kind === "reading";
  const verdict = status === "idle" ? "" : status === "correct" ? ", correct" : ", wrong";

  return (
    <TextInput
      testID={testID}
      value={value}
      onChangeText={(text) => onChangeText(reading ? toReadingInput(text) : text)}
      onSubmitEditing={onSubmit}
      submitBehavior="submit"
      returnKeyType={status === "idle" ? "done" : "next"}
      autoFocus
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="off"
      spellCheck={false}
      placeholder={reading ? "Type the reading (romaji becomes kana)" : "Type the meaning"}
      placeholderTextColor={palette.muted}
      accessibilityLabel={`${reading ? "Reading" : "Meaning"} answer${verdict}`}
      maxFontSizeMultiplier={1.4}
      className={`min-h-14 rounded-md border-2 px-4 py-3 text-center text-2xl text-text ${reading ? "font-jp" : ""} ${statusClasses[status]}`}
    />
  );
}
