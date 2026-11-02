import { randomUUID } from "expo-crypto";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import {
  DoneCard,
  HeaderCount,
  LeaveDialog,
  LoadingState,
  MessageCard,
  QuizView,
  useLeaveGuard,
  useQuizSession,
} from "@/components/study";
import { Screen } from "@/components/ui";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db/client";
import { loadReviewSession, submitReview, type ReviewItem } from "@/lib/study/reviews";

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: ReviewItem[] };

// Reviews (spec 0004 AC-8 to AC-11): every due item, questions shuffled together.
export default function ReviewsScreen() {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ status: "loading" });

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

  const home = () => router.navigate("/");

  if (load.status === "ready" && load.items.length > 0) {
    return <ReviewSession items={load.items} onHome={home} />;
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

function ReviewSession({ items, onHome }: { items: ReviewItem[]; onHome: () => void }) {
  const session = useQuizSession(
    items.map((i) => i.subject),
    (item) => submitReview(getDb(), getCurrentUserId(), item, now(), randomUUID),
  );
  const guard = useLeaveGuard(session.answeredAny && !session.done);

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: "Reviews",
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
