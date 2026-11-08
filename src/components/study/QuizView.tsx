import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Mnemonic, NoteText } from "@/components/subject/Section";

import { Button, Card } from "@/components/ui";
import { acceptedAnswers } from "@/lib/answer/check";
import { usePalette } from "@/theme/use-palette";

import { AnswerInput } from "./AnswerInput";
import { PromptBand } from "./PromptBand";
import { detailsFor } from "./quiz-details";
import type { QuizSession, QuizSubject } from "./use-quiz-session";

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
            {question.kind === "meaning" ? "Accepted meanings" : "Accepted readings"}
          </Text>
          <Text
            testID="accepted-answers"
            className={`text-lg text-text ${question.kind === "reading" ? "font-jp" : ""}`}
          >
            {acceptedAnswers(question.kind, subject, subject.synonyms).join(", ")}
          </Text>
          <ShowDetails kind={question.kind} subject={subject} />
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
          : question.kind === "reading"
            ? "Romaji turns into kana as you type. Press enter to check."
            : "Press the keyboard's enter key to check."}
      </Text>
    </View>
  );
}

// "Show details" under a wrong answer (spec 0009 AC-7). Mounted with the Not quite card, so it
// starts collapsed for every new question.
function ShowDetails({ kind, subject }: { kind: "meaning" | "reading"; subject: QuizSubject }) {
  const palette = usePalette();
  const [open, setOpen] = useState(false);
  const shown = detailsFor(kind, subject.details);
  if (!shown) return null;
  return (
    <View className="gap-2">
      <Pressable
        testID="show-details"
        accessibilityRole="button"
        accessibilityLabel={open ? "Hide details" : "Show details"}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        className="min-h-12 flex-row items-center gap-2 active:opacity-85"
      >
        <MaterialCommunityIcons
          name={open ? "chevron-up" : "chevron-down"}
          size={20}
          color={palette.primary}
        />
        <Text className="text-base font-bold text-primary">
          {open ? "Hide details" : "Show details"}
        </Text>
      </Pressable>
      {open && (
        <View testID="quiz-details" className="gap-2">
          <Mnemonic text={shown.mnemonic} />
          <NoteText
            label={kind === "meaning" ? "Your meaning note" : "Your reading note"}
            text={shown.note}
          />
        </View>
      )}
    </View>
  );
}
