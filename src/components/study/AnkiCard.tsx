import { Text, View } from "react-native";

import { Readings } from "@/components/subject/Section";
import { Button, Card } from "@/components/ui";

import { cardDetails, cardMeanings } from "./quiz-details";
import { ShowDetails } from "./ShowDetails";
import type { QuizSubject } from "./use-quiz-session";

// Anki mode's answer area (spec 0012 AC-3, AC-4): Show answer, then the meanings with your
// synonyms, the readings for kanji and vocab, Show details, and the Missed and Got it grades.
// Reads the live session subject, so a synonym added from the sheet shows at once.
export function AnkiCard({
  subject,
  revealed,
  saving,
  onReveal,
  onGrade,
}: {
  subject: QuizSubject;
  revealed: boolean;
  saving: boolean;
  onReveal: () => void;
  onGrade: (right: boolean) => void;
}) {
  if (!revealed) {
    return (
      <View className="gap-2">
        <Button label="Show answer" icon="eye" testID="anki-show-answer" onPress={onReveal} />
        <Text className="text-center text-sm text-muted">Recall it in your head, then check.</Text>
      </View>
    );
  }

  const meanings = cardMeanings(subject, subject.synonyms);
  return (
    <View className="gap-4">
      <View testID="anki-answer" accessible={false} accessibilityLiveRegion="polite">
        <Card>
          <Text className="text-sm font-bold uppercase text-muted">Meaning</Text>
          <Text testID="anki-meanings" className="text-lg text-text">
            {meanings.join(", ")}
          </Text>
          {subject.type !== "radical" && (
            <View className="gap-1">
              <Text className="text-sm font-bold uppercase text-muted">Reading</Text>
              <Readings type={subject.type} readings={subject.readings} />
            </View>
          )}
          <ShowDetails parts={cardDetails(subject.type, subject.details)} />
        </Card>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Button
            label="Missed"
            icon="close"
            variant="danger"
            testID="anki-missed"
            loading={saving}
            onPress={() => onGrade(false)}
          />
        </View>
        <View className="flex-1">
          <Button
            label="Got it"
            icon="check"
            testID="anki-got-it"
            loading={saving}
            onPress={() => onGrade(true)}
          />
        </View>
      </View>
    </View>
  );
}
