import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { Button, Card } from "@/components/ui";
import { acceptedAnswers } from "@/lib/answer/check";
import { usePalette } from "@/theme/use-palette";

import { AnswerInput } from "./AnswerInput";
import { PromptBand } from "./PromptBand";
import type { QuizSession } from "./use-quiz-session";

// The question, the answer field, and the result under it. Rendered while questions remain.
export function QuizView({ session }: { session: QuizSession }) {
  const palette = usePalette();
  const { question, subject, verdict } = session;
  if (!question || !subject) return null;

  return (
    <View className="gap-4">
      <PromptBand type={subject.type} characters={subject.characters} kind={question.kind} />

      <AnswerInput
        kind={question.kind}
        value={session.input}
        onChangeText={session.setInput}
        onSubmit={session.submit}
        status={verdict ?? "idle"}
        testID="answer-input"
      />

      {verdict === "wrong" && (
        <Card>
          <View
            className="flex-row items-center gap-2"
            accessible
            accessibilityLiveRegion="assertive"
          >
            <MaterialCommunityIcons name="close-circle" size={20} color={palette.wrong} />
            <Text className="text-base font-bold text-wrong">Not quite</Text>
          </View>
          <Text className="text-sm text-muted">
            {question.kind === "meaning" ? "Accepted meanings" : "Accepted readings"}
          </Text>
          <Text
            testID="accepted-answers"
            className={`text-lg text-text ${question.kind === "reading" ? "font-jp" : ""}`}
          >
            {acceptedAnswers(question.kind, subject).join(", ")}
          </Text>
        </Card>
      )}

      {verdict === "correct" && (
        <View
          className="flex-row items-center justify-center gap-2"
          accessible
          accessibilityLiveRegion="polite"
        >
          <MaterialCommunityIcons name="check-circle" size={20} color={palette.correct} />
          <Text className="text-base font-bold text-correct">Correct</Text>
        </View>
      )}

      <Button
        label={verdict === null ? "Check" : "Next"}
        icon={verdict === null ? "check" : "arrow-right"}
        testID="answer-submit"
        disabled={verdict === null && session.input.trim() === ""}
        loading={session.saving}
        onPress={session.submit}
      />
      <Text className="text-center text-sm text-muted">
        {verdict === null
          ? "Press the keyboard's enter key to check."
          : "Press enter again for the next question."}
      </Text>
    </View>
  );
}
