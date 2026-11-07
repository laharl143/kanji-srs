import { MaterialCommunityIcons } from "@expo/vector-icons";
import { memo, useCallback, useMemo } from "react";
import { SectionList, Text, View, type SectionListRenderItem } from "react-native";

import { Button, Card, SubjectChip } from "@/components/ui";
import type { ReviewResult } from "@/lib/study/reviews";
import {
  describeChange,
  summarizeReviews,
  type SessionSummary,
  type SummaryEntry,
} from "@/lib/study/summary";
import { primaryMeaning } from "@/lib/subjects";
import { usePalette } from "@/theme/use-palette";

import type { QuizSubject, SavedItem } from "./use-quiz-session";

// Home's counts, read when the summary opens, for the next step buttons (spec 0006 AC-10).
export type NextCounts =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; lessons: number; reviews: number };

type ReviewSummaryProps = {
  results: readonly SavedItem<ReviewResult>[];
  subjects: readonly QuizSubject[];
  accuracy: number | null;
  next: NextCounts;
  onHome: () => void;
  onStartLessons: () => void;
  onKeepReviewing: () => void;
};

type Group = {
  key: "correct" | "incorrect";
  title: string;
  testID: "summary-correct" | "summary-incorrect";
  empty: string;
  data: SummaryEntry[];
};

/**
 * The end of a review session (spec 0006 AC-9, AC-10), in place of the Done card. Keeps its
 * "Done, N items" title and the `session-done` and `session-home` test IDs for
 * `maestro/core-loop.yaml`. A virtualized list, because a long session can list hundreds of items.
 */
export function ReviewSummary({
  results,
  subjects,
  accuracy,
  next,
  onHome,
  onStartLessons,
  onKeepReviewing,
}: ReviewSummaryProps) {
  const summary = useMemo(() => summarizeReviews(results), [results]);
  const byId = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const sections = useMemo<Group[]>(
    () =>
      summary.saved === 0
        ? []
        : [
            {
              key: "correct",
              title: "Correct",
              testID: "summary-correct",
              empty: "Every item had at least one miss.",
              data: summary.correct,
            },
            {
              key: "incorrect",
              title: "Incorrect",
              testID: "summary-incorrect",
              empty: "No misses this time.",
              data: summary.incorrect,
            },
          ],
    [summary],
  );

  const renderItem = useCallback<SectionListRenderItem<SummaryEntry, Group>>(
    ({ item }) => {
      const subject = byId.get(item.subjectId);
      return subject ? <SummaryRow entry={item} subject={subject} /> : null;
    },
    [byId],
  );

  return (
    <SectionList
      sections={sections}
      keyExtractor={keyOf}
      renderItem={renderItem}
      renderSectionHeader={renderGroupHeader}
      renderSectionFooter={renderGroupFooter}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        <SummaryTop
          summary={summary}
          accuracy={accuracy}
          next={next}
          onHome={onHome}
          onStartLessons={onStartLessons}
          onKeepReviewing={onKeepReviewing}
        />
      }
      ListFooterComponent={<View className="h-4" />}
    />
  );
}

const keyOf = (entry: SummaryEntry) => String(entry.subjectId);
const renderGroupHeader = ({ section }: { section: Group }) => <GroupHeader group={section} />;
const renderGroupFooter = ({ section }: { section: Group }) =>
  section.data.length === 0 ? (
    <Text className="mx-4 mb-2 text-base text-muted">{section.empty}</Text>
  ) : null;

function SummaryTop({
  summary,
  accuracy,
  next,
  onHome,
  onStartLessons,
  onKeepReviewing,
}: {
  summary: SessionSummary;
  accuracy: number | null;
  next: NextCounts;
  onHome: () => void;
  onStartLessons: () => void;
  onKeepReviewing: () => void;
}) {
  const palette = usePalette();
  const n = summary.saved;
  // Home only until the counts are read, and when they could not be.
  const reviews = next.status === "ready" ? next.reviews : 0;
  const lessons = next.status === "ready" ? next.lessons : 0;

  return (
    <View className="gap-4 px-4 pb-2 pt-4">
      <Card>
        <View className="items-center gap-3 py-2" testID="session-done">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <MaterialCommunityIcons name="check-decagram" size={32} color={palette.primary} />
          </View>
          <Text accessibilityRole="header" className="text-center text-xl font-bold text-text">
            {`Done, ${n} ${n === 1 ? "item" : "items"}`}
          </Text>
          <Text className="text-center text-base text-muted">
            {n === 0
              ? "Nothing finished this time. Items you did not finish are still due."
              : "Your answers are saved. Each item comes back for review when it is due."}
          </Text>
        </View>
        {n > 0 ? (
          <View className="flex-row gap-2">
            <Stat
              value={String(summary.correct.length)}
              label="Correct"
              spoken={`${summary.correct.length} correct`}
              tone="text-correct"
            />
            <Stat
              value={String(summary.incorrect.length)}
              label="Incorrect"
              spoken={`${summary.incorrect.length} incorrect`}
              tone="text-wrong"
            />
            <Stat
              value={accuracy === null ? "–" : `${accuracy}%`}
              label="Accuracy"
              spoken={accuracy === null ? "No accuracy" : `Accuracy ${accuracy} percent`}
              tone="text-text"
            />
          </View>
        ) : null}
      </Card>

      {summary.levelUp !== null ? <LevelBanner level={summary.levelUp} /> : null}
      {summary.newLessons > 0 ? <NewLessons count={summary.newLessons} /> : null}

      <View className="gap-2">
        {reviews > 0 ? (
          <Button
            label={`Keep reviewing (${reviews})`}
            icon="cards"
            testID="summary-keep-reviewing"
            onPress={onKeepReviewing}
          />
        ) : null}
        {lessons > 0 ? (
          <Button
            label={`Start lessons (${lessons})`}
            icon="book-open-page-variant"
            variant={reviews > 0 ? "secondary" : "primary"}
            testID="summary-start-lessons"
            onPress={onStartLessons}
          />
        ) : null}
        <Button
          label="Home"
          icon="home"
          variant={reviews > 0 || lessons > 0 ? "secondary" : "primary"}
          testID="session-home"
          onPress={onHome}
        />
      </View>
    </View>
  );
}

function Stat({
  value,
  label,
  spoken,
  tone,
}: {
  value: string;
  label: string;
  spoken: string;
  tone: "text-correct" | "text-wrong" | "text-text";
}) {
  return (
    <View
      accessible
      accessibilityLabel={spoken}
      className="flex-1 items-center gap-1 rounded-md bg-bg py-3"
    >
      <Text maxFontSizeMultiplier={1.5} className={`text-2xl font-bold ${tone}`}>
        {value}
      </Text>
      <Text className="text-sm text-muted">{label}</Text>
    </View>
  );
}

function LevelBanner({ level }: { level: number }) {
  const palette = usePalette();
  return (
    <View
      testID="summary-level-up"
      accessible
      accessibilityLabel={`Level ${level} is open`}
      className="flex-row items-center gap-3 rounded-lg bg-primary p-4"
    >
      <MaterialCommunityIcons name="trophy" size={28} color={palette["on-primary"]} />
      <Text className="flex-1 text-lg font-bold text-on-primary">{`Level ${level} is open`}</Text>
    </View>
  );
}

function NewLessons({ count }: { count: number }) {
  const palette = usePalette();
  const text = `${count} new ${count === 1 ? "lesson" : "lessons"} unlocked`;
  return (
    <View
      testID="summary-new-lessons"
      accessible
      accessibilityLabel={text}
      className="flex-row items-center gap-3 rounded-lg bg-surface p-4 shadow-sm dark:border dark:border-border dark:shadow-none"
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-kanji">
        <MaterialCommunityIcons name="lock-open-variant" size={20} color={palette["on-primary"]} />
      </View>
      <Text className="flex-1 text-base font-bold text-text">{text}</Text>
    </View>
  );
}

function GroupHeader({ group }: { group: Group }) {
  const palette = usePalette();
  const n = group.data.length;
  const correct = group.key === "correct";
  return (
    <View
      testID={group.testID}
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${group.title}, ${n} ${n === 1 ? "item" : "items"}`}
      className="flex-row items-center gap-2 px-4 pb-2 pt-4"
    >
      <MaterialCommunityIcons
        name={correct ? "check-circle" : "close-circle"}
        size={20}
        color={correct ? palette.correct : palette.wrong}
      />
      <Text className="text-lg font-bold text-text">{group.title}</Text>
      <Text className="text-base text-muted">{n}</Text>
    </View>
  );
}

// One finished item: its chip (opens the item page), meaning, and stage change. TalkBack reads
// the chip, then the change in words, which carries the up or down mark.
const SummaryRow = memo(function SummaryRow({
  entry,
  subject,
}: {
  entry: SummaryEntry;
  subject: QuizSubject;
}) {
  const palette = usePalette();
  const meaning = primaryMeaning(subject.meanings);
  const { change } = entry;
  return (
    <View className="mx-4 mb-2 flex-row items-center gap-3 rounded-md bg-surface px-3 py-2 dark:border dark:border-border">
      <SubjectChip
        subject={{ id: subject.id, type: subject.type, characters: subject.characters, meaning }}
        size="sm"
      />
      <View className="flex-1 gap-0.5" accessible accessibilityLabel={describeChange(change)}>
        <Text numberOfLines={1} className="text-base text-text">
          {meaning}
        </Text>
        <Text className="text-sm text-muted">{`${change.from} → ${change.to}`}</Text>
      </View>
      {change.direction === "same" ? null : (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <MaterialCommunityIcons
            name={change.direction === "up" ? "arrow-up-bold" : "arrow-down-bold"}
            size={24}
            color={change.direction === "up" ? palette.correct : palette.wrong}
          />
        </View>
      )}
    </View>
  );
});
