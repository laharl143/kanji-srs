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
  SynonymButton,
  synonymSheetTitle,
  useLeaveGuard,
  useQuizSession,
} from "@/components/study";
import { SynonymSheet } from "@/components/subject";
import { Button, ProgressBar, Screen } from "@/components/ui";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db/client";
import { getSettings } from "@/lib/db/queries/settings";
import { useSessionReminders } from "@/lib/notifications/use-reminders";
import { loadCourseForms } from "@/lib/study/answers";
import { completeLessonItem, loadLessonBatch, type LessonItem } from "@/lib/study/lessons";
import type { StudyMode } from "@/lib/study/queue";

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: LessonItem[]; courseForms: ReadonlySet<string>; mode: StudyMode };

// Lessons (spec 0004 AC-6, AC-7, AC-11): one page per item, then the quiz, then "Done".
export default function LessonsScreen() {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ status: "loading" });

  const fetchBatch = useCallback(() => {
    // The course word forms load with the batch; either failing shows the error card (0007 AC-12).
    // The study style is read once here for the quiz (spec 0012 AC-2, AC-8).
    Promise.all([
      loadLessonBatch(getDb(), getCurrentUserId()),
      loadCourseForms(getDb()),
      getSettings(getDb(), getCurrentUserId()),
    ]).then(
      ([items, courseForms, settings]) =>
        setLoad({
          status: "ready",
          items,
          courseForms,
          mode: settings?.ankiMode ? "anki" : "typed",
        }),
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
  return (
    <LessonFlow items={load.items} courseForms={load.courseForms} mode={load.mode} onHome={home} />
  );
}

type FlowProps = {
  items: LessonItem[];
  courseForms: ReadonlySet<string>;
  mode: StudyMode;
  onHome: () => void;
};

function LessonFlow({ items: loaded, courseForms, mode, onHome }: FlowProps) {
  // The batch, with each item's synonyms replaced after a save from the sheet, so the page and
  // the quiz built from it both use the saved list (spec 0011 AC-2).
  const [items, setItems] = useState(loaded);
  const [page, setPage] = useState(0);
  const [quiz, setQuiz] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  if (quiz) {
    return <LessonQuiz items={items} courseForms={courseForms} mode={mode} onHome={onHome} />;
  }

  const last = page === items.length - 1;
  const item = items[page];
  const setSynonyms = (synonyms: string[]) =>
    setItems((list) =>
      list.map((i) => (i.subject.id === item.subject.id ? { ...i, synonyms } : i)),
    );
  // The sheet sits outside the page's ScrollView: a Modal's touches bubble through its React
  // parents, and that ScrollView would close the keyboard and swallow the first tap on Add.
  return (
    <>
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
        <LessonPage item={item} onAddSynonym={() => setSheetOpen(true)} />
      </PagedLayout>
      <SynonymSheet
        visible={sheetOpen}
        title={synonymSheetTitle(item.subject.characters)}
        subjectId={item.subject.id}
        synonyms={item.synonyms}
        onChange={setSynonyms}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}

function LessonQuiz({ items, courseForms, mode, onHome }: FlowProps) {
  const session = useQuizSession(
    items.map((i) => ({ ...i.subject, synonyms: i.synonyms, details: i.details })),
    (item) => completeLessonItem(getDb(), getCurrentUserId(), item.subjectId, now()),
    { courseForms, mode },
  );
  const guard = useLeaveGuard(session.answeredAny && !session.done);
  // New reviews from this batch change the reminders; the first finished batch asks once for the
  // notification permission (0001 §6.5).
  useSessionReminders(session.done, session.answeredAny, { askPermission: true });
  const [sheetOpen, setSheetOpen] = useState(false);
  const subject = session.done ? undefined : session.subject;

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: "Lesson quiz",
          headerRight: session.done
            ? undefined
            : () => (
                <View className="flex-row items-center gap-1">
                  {subject && <SynonymButton onPress={() => setSheetOpen(true)} />}
                  <HeaderCount remaining={session.remaining} testID="session-remaining" />
                </View>
              ),
        }}
      />
      {session.done ? (
        <DoneCard count={session.saved} onHome={onHome} />
      ) : (
        <QuizView session={session} />
      )}
      {subject && (
        <SynonymSheet
          visible={sheetOpen}
          title={synonymSheetTitle(subject.characters)}
          subjectId={subject.id}
          synonyms={subject.synonyms}
          onChange={(synonyms) => session.setSynonyms(subject.id, synonyms)}
          onClose={() => setSheetOpen(false)}
        />
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
