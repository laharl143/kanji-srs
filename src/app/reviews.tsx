import { randomUUID } from "expo-crypto";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";

import {
  HeaderCount,
  LeaveDialog,
  LoadingState,
  MessageCard,
  QuizView,
  ReviewSummary,
  useLeaveGuard,
  useQuizSession,
  type NextCounts,
} from "@/components/study";
import { Button, Screen } from "@/components/ui";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db/client";
import { getHomeCounts } from "@/lib/study/home";
import { REVIEW_WINDOW_SIZE } from "@/lib/study/queue";
import { loadReviewSession, submitReview, type ReviewItem } from "@/lib/study/reviews";

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: ReviewItem[] };

// Reviews (spec 0004 AC-8 to AC-11, spec 0006 AC-6 to AC-10): every due item, 10 in play at a
// time, with Wrap up, then the session summary.
export default function ReviewsScreen() {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  // A fresh key per session, so Keep reviewing never reuses the last session's state.
  const [run, setRun] = useState(0);

  const fetchSession = useCallback(() => {
    loadReviewSession(getDb(), getCurrentUserId(), now()).then(
      (items) => setLoad({ status: "ready", items }),
      (e) => setLoad({ status: "error", message: e instanceof Error ? e.message : String(e) }),
    );
  }, []);
  useEffect(() => {
    fetchSession();
  }, [fetchSession]);
  const retry = () => {
    setLoad({ status: "loading" });
    fetchSession();
  };
  // Keep reviewing: a new session with whatever is due now.
  const keepReviewing = () => {
    setRun((n) => n + 1);
    retry();
  };

  const home = () => router.navigate("/");
  const startLessons = () => router.replace("/lessons");

  if (load.status === "ready" && load.items.length > 0) {
    return (
      <ReviewSession
        key={run}
        items={load.items}
        onHome={home}
        onStartLessons={startLessons}
        onKeepReviewing={keepReviewing}
      />
    );
  }
  return (
    <Screen>
      <Stack.Screen options={{ title: "Reviews" }} />
      {load.status === "loading" && <LoadingState label="Loading reviews" />}
      {load.status === "error" && (
        <MessageCard
          icon="alert-circle-outline"
          title="Reviews could not load"
          body={load.message}
          actionLabel="Home"
          onAction={home}
          secondary={{ label: "Try again", onPress: retry }}
        />
      )}
      {load.status === "ready" && (
        <MessageCard
          icon="calendar-check-outline"
          title="No reviews right now"
          body="Everything is up to date. Items come back for review on their own schedule."
          actionLabel="Home"
          onAction={home}
          testID="reviews-empty"
        />
      )}
    </Screen>
  );
}

function ReviewSession({
  items,
  onHome,
  onStartLessons,
  onKeepReviewing,
}: {
  items: ReviewItem[];
  onHome: () => void;
  onStartLessons: () => void;
  onKeepReviewing: () => void;
}) {
  const [subjects] = useState(() => items.map((i) => i.subject));
  const session = useQuizSession(
    subjects,
    (item) => submitReview(getDb(), getCurrentUserId(), item, now(), randomUUID),
    { windowSize: REVIEW_WINDOW_SIZE },
  );
  const guard = useLeaveGuard(session.answeredAny && !session.done);
  const next = useNextCounts(session.done);

  const header = (
    <Stack.Screen
      options={{
        title: "Reviews",
        headerRight: session.done
          ? undefined
          : () => (
              <HeaderCount
                remaining={session.remaining}
                accuracy={session.accuracy}
                testID="session-remaining"
              />
            ),
      }}
    />
  );

  if (session.done) {
    return (
      <Screen scroll={false} padded={false}>
        {header}
        <ReviewSummary
          results={session.results}
          subjects={subjects}
          accuracy={session.accuracy}
          next={next}
          onHome={onHome}
          onStartLessons={onStartLessons}
          onKeepReviewing={onKeepReviewing}
        />
        <LeaveDialog guard={guard} />
      </Screen>
    );
  }
  return (
    <Screen>
      {header}
      <QuizView session={session} />
      {session.canWrapUp && session.question ? (
        <WrapUp
          wrappingUp={session.wrappingUp}
          waiting={session.waiting}
          onToggle={session.toggleWrapUp}
        />
      ) : null}
      <LeaveDialog guard={guard} />
    </Screen>
  );
}

// Under the answer button while items wait to join (spec 0006 AC-7). Wrap up lets the items in
// play finish and joins nothing new; Keep going fills the window back up.
function WrapUp({
  wrappingUp,
  waiting,
  onToggle,
}: {
  wrappingUp: boolean;
  waiting: number;
  onToggle: () => void;
}) {
  return (
    <View className="gap-2">
      <Button
        label={wrappingUp ? "Keep going" : "Wrap up"}
        icon={wrappingUp ? "play" : "flag-checkered"}
        variant="secondary"
        testID="review-wrap-up"
        onPress={onToggle}
      />
      {wrappingUp ? (
        <Text className="text-center text-sm text-muted" accessibilityLiveRegion="polite">
          {`Wrapping up: finish the items in play. ${waiting} more ${waiting === 1 ? "stays" : "stay"} due for later.`}
        </Text>
      ) : null}
    </View>
  );
}

// Home's counts, read once when the session ends, for the summary's buttons (spec 0006 AC-10).
function useNextCounts(sessionDone: boolean): NextCounts {
  const [counts, setCounts] = useState<NextCounts>({ status: "loading" });
  useEffect(() => {
    if (!sessionDone) return;
    let active = true;
    getHomeCounts(getDb(), getCurrentUserId(), now()).then(
      (c) => active && setCounts({ status: "ready", ...c }),
      () => active && setCounts({ status: "error" }),
    );
    return () => {
      active = false;
    };
  }, [sessionDone]);
  return counts;
}
