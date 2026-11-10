import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { Button, Card } from "@/components/ui";
import { acceptedAnswers } from "@/lib/answer/check";
import { usePalette } from "@/theme/use-palette";

import { AnkiCard } from "./AnkiCard";
import { AnswerInput } from "./AnswerInput";
import { PromptBand } from "./PromptBand";
import { detailParts } from "./quiz-details";
import { ShowDetails } from "./ShowDetails";
import type { QuizSession } from "./use-quiz-session";

// The question, the answer field, and the result under it. Rendered while questions remain. An
// Anki card (spec 0012) shows the reveal and grade buttons instead of the field.
export function QuizView({ session }: { session: QuizSession }) {
  const palette = usePalette();
  const { question, subject, verdict } = session;
  if (!question || !subject) return null;

  if (question.kind === "card") {
    return (
      <View className="gap-4">
        <PromptBand type={subject.type} characters={subject.characters} kind="card" />
        <AnkiCard
          key={question.subjectId}
          subject={subject}
          revealed={session.revealed}
          saving={session.saving}
          onReveal={session.reveal}
          onGrade={session.grade}
        />
      </View>
    );
  }
  const kind = question.kind;

  return (
    <View className="gap-4">
      <PromptBand type={subject.type} characters={subject.characters} kind={kind} />

      <AnswerInput
        kind={kind}
        value={session.input}
        onChangeText={session.setInput}
        onSubmit={session.submit}
        status={verdict ?? "idle"}
        shakeKey={session.shakeKey}
        testID="answer-input"
      />

      {session.hint !== null && verdict === null && (
        <View
          key={session.shakeKey}
          testID="answer-hint"
          className="flex-row items-center justify-center gap-2"
          accessible
          accessibilityLiveRegion="assertive"
        >
          <MaterialCommunityIcons name="information" size={20} color={palette.muted} />
          <Text className="text-base font-bold text-text">{session.hint}</Text>
        </View>
      )}

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
            {kind === "meaning" ? "Accepted meanings" : "Accepted readings"}
          </Text>
          <Text
            testID="accepted-answers"
            className={`text-lg text-text ${kind === "reading" ? "font-jp" : ""}`}
          >
            {acceptedAnswers(kind, subject, subject.synonyms).join(", ")}
          </Text>
          <ShowDetails parts={detailParts(kind, subject.details)} />
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

      {verdict === "close" && (
        <View testID="answer-close" className="items-center gap-1" accessible>
          <View className="flex-row items-center gap-2" accessibilityLiveRegion="polite">
            <MaterialCommunityIcons name="check-circle" size={20} color={palette.correct} />
            <Text className="text-base font-bold text-correct">Close enough</Text>
          </View>
          <Text className="text-base text-text">{`Answer: ${session.closeTo ?? ""}`}</Text>
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
        {verdict !== null
          ? "Press enter again for the next question."
          : kind === "reading"
            ? "Romaji turns into kana as you type. Press enter to check."
            : "Press the keyboard's enter key to check."}
      </Text>
    </View>
  );
}
