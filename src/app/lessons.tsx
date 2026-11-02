import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  DoneCard,
  HeaderCount,
  LeaveDialog,
  LessonPage,
  LoadingState,
  MessageCard,
  QuizView,
  useLeaveGuard,
  useQuizSession,
} from "@/components/study";
import { Button, ProgressBar, Screen } from "@/components/ui";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db/client";
import { completeLessonItem, loadLessonBatch, type LessonItem } from "@/lib/study/lessons";

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: LessonItem[] };

// Lessons (spec 0004 AC-6, AC-7, AC-11): one page per item, then the quiz, then "Done".
export default function LessonsScreen() {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ status: "loading" });

  const fetchBatch = useCallback(() => {
    loadLessonBatch(getDb(), getCurrentUserId()).then(
      (items) => setLoad({ status: "ready", items }),
      (e) => setLoad({ status: "error", message: e instanceof Error ? e.message : String(e) }),
    );
  }, []);
  useEffect(() => {
    fetchBatch();
  }, [fetchBatch]);
  const retry = () => {
    setLoad({ status: "loading" });
    fetchBatch();
  };

  const home = () => router.navigate("/");

  if (load.status !== "ready" || load.items.length === 0) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Lessons" }} />
        {load.status === "loading" && <LoadingState label="Loading lessons" />}
        {load.status === "error" && (
          <MessageCard
            icon="alert-circle-outline"
            title="Lessons could not load"
            body={load.message}
            actionLabel="Home"
            onAction={home}
            secondary={{ label: "Try again", onPress: retry }}
          />
        )}
        {load.status === "ready" && (
          <MessageCard
            icon="book-open-page-variant-outline"
            title="No lessons right now"
            body="New items unlock as you pass reviews. Check back after your next review session."
            actionLabel="Home"
            onAction={home}
            testID="lessons-empty"
          />
        )}
      </Screen>
    );
  }
  return <LessonFlow items={load.items} onHome={home} />;
}

function LessonFlow({ items, onHome }: { items: LessonItem[]; onHome: () => void }) {
  const [page, setPage] = useState(0);
  const [quiz, setQuiz] = useState(false);
  if (quiz) return <LessonQuiz items={items} onHome={onHome} />;

  const last = page === items.length - 1;
  return (
    <PagedLayout
      title="Lessons"
      footer={
        <>
          <ProgressBar
            label={`Item ${page + 1} of ${items.length}`}
            value={page + 1}
            max={items.length}
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button
                label="Back"
                icon="arrow-left"
                variant="secondary"
                disabled={page === 0}
                testID="lesson-back"
                onPress={() => setPage((p) => p - 1)}
              />
            </View>
            <View className="flex-1">
              <Button
                label={last ? "Start quiz" : "Next"}
                icon={last ? "pencil" : "arrow-right"}
                testID="lesson-next"
                onPress={() => (last ? setQuiz(true) : setPage((p) => p + 1))}
              />
            </View>
          </View>
        </>
      }
    >
      <LessonPage item={items[page]} />
    </PagedLayout>
  );
}

function LessonQuiz({ items, onHome }: { items: LessonItem[]; onHome: () => void }) {
  const session = useQuizSession(
    items.map((i) => i.subject),
    (item) => completeLessonItem(getDb(), getCurrentUserId(), item.subjectId, now()),
  );
  const guard = useLeaveGuard(session.answeredAny && !session.done);

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: "Lesson quiz",
          headerRight: session.done
            ? undefined
            : () => <HeaderCount remaining={session.remaining} testID="session-remaining" />,
        }}
      />
      {session.done ? (
        <DoneCard count={session.saved} onHome={onHome} />
      ) : (
        <QuizView session={session} />
      )}
      <LeaveDialog guard={guard} />
    </Screen>
  );
}

// A scrolling page with a footer pinned above the bottom safe area.
function PagedLayout({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-bg" style={{ paddingLeft: insets.left, paddingRight: insets.right }}>
      <Stack.Screen options={{ title }} />
      <ScrollView className="flex-1" contentContainerClassName="p-4 gap-4">
        {children}
      </ScrollView>
      <View
        className="gap-3 border-t border-border bg-surface px-4 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        {footer}
      </View>
    </View>
  );
}
