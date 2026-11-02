import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState, type ComponentProps } from "react";
import { Text, View } from "react-native";

import { Button, Card, Screen } from "@/components/ui";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { CLOCK_DEBUG_ENABLED, now } from "@/lib/clock";
import { getDb } from "@/lib/db/client";
import { getMeta, setMeta } from "@/lib/db/queries/meta";
import { withTransaction } from "@/lib/db/transaction";
import { getHomeCounts } from "@/lib/study/home";
import { usePalette } from "@/theme/use-palette";

type Counts = { lessons: number; reviews: number };
type Load =
  { status: "loading" } | { status: "error"; message: string } | ({ status: "ready" } & Counts);

// Home (spec 0004 AC-12): lessons and reviews waiting now, refreshed whenever Home regains focus.
export default function HomeScreen() {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ status: "loading" });

  const refresh = useCallback(() => {
    let active = true;
    getHomeCounts(getDb(), getCurrentUserId(), now()).then(
      (counts) => active && setLoad({ status: "ready", ...counts }),
      (e) =>
        active && setLoad({ status: "error", message: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      active = false;
    };
  }, []);
  useFocusEffect(refresh);

  const counts = load.status === "ready" ? load : undefined;
  return (
    <Screen bottomInset={false}>
      <View className="gap-1 px-1">
        <Text accessibilityRole="header" className="text-2xl font-bold text-text">
          Today
        </Text>
        <Text className="text-base text-muted">
          Learn new items in lessons, then keep them fresh with reviews.
        </Text>
      </View>

      {load.status === "error" && (
        <Card title="Counts could not load">
          <Text className="text-base text-muted">{load.message}</Text>
          <Button label="Try again" variant="secondary" onPress={refresh} />
        </Card>
      )}

      <StudyCard
        title="Lessons"
        icon="book-open-page-variant"
        tone="bg-kanji"
        count={counts?.lessons}
        idle="No new items right now."
        waiting="new items ready to learn"
        countTestID="home-lessons-count"
        startTestID="home-start-lessons"
        onStart={() => router.push("/lessons")}
      />
      <StudyCard
        title="Reviews"
        icon="cards"
        tone="bg-radical"
        count={counts?.reviews}
        idle="Nothing is due. Reviews appear as items come due."
        waiting="items due for review"
        countTestID="home-reviews-count"
        startTestID="home-start-reviews"
        onStart={() => router.push("/reviews")}
      />

      {CLOCK_DEBUG_ENABLED && <DevTools />}
    </Screen>
  );
}

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

function StudyCard({
  title,
  icon,
  tone,
  count,
  idle,
  waiting,
  countTestID,
  startTestID,
  onStart,
}: {
  title: string;
  icon: IconName;
  // Literal class names, so NativeWind can see them.
  tone: "bg-kanji" | "bg-radical";
  count: number | undefined;
  idle: string;
  waiting: string;
  countTestID: string;
  startTestID: string;
  onStart: () => void;
}) {
  const palette = usePalette();
  const loading = count === undefined;
  return (
    <View className="overflow-hidden rounded-lg bg-surface shadow-sm dark:border dark:border-border dark:shadow-none">
      <View className={`flex-row items-center gap-3 px-4 py-3 ${tone}`}>
        <MaterialCommunityIcons name={icon} size={24} color={palette["on-primary"]} />
        <Text accessibilityRole="header" className="flex-1 text-lg font-bold text-white">
          {title}
        </Text>
        <Text
          testID={countTestID}
          accessibilityLabel={loading ? `${title} loading` : `${count} ${title.toLowerCase()}`}
          className="text-3xl font-bold text-white"
        >
          {loading ? "–" : count}
        </Text>
      </View>
      <View className="gap-3 p-4">
        <Text className="text-base text-muted">
          {loading ? "Counting…" : count === 0 ? idle : `${count} ${waiting}.`}
        </Text>
        <Button
          label={`Start ${title.toLowerCase()}`}
          icon="play"
          testID={startTestID}
          disabled={loading || count === 0}
          onPress={onStart}
        />
      </View>
    </View>
  );
}

const CHECK_KEY = "dev_rollback_check";

// Development tools: the debug clock (development and e2e builds, spec 0004 AC-13), plus the UI
// preview (spec 0003 AC-7) and the rollback device check (spec 0002 AC-7) in development only.
function DevTools() {
  const router = useRouter();
  const [result, setResult] = useState<string>();

  async function run() {
    const db = getDb();
    try {
      await withTransaction(db, async (tx) => {
        await setMeta(tx, CHECK_KEY, String(now().getTime()));
        throw new Error("planned failure");
      });
    } catch {
      // Expected: the transaction always throws.
    }
    const row = await getMeta(db, CHECK_KEY);
    setResult(row === undefined ? "Rollback OK: no row written" : `Rollback FAILED: found ${row}`);
  }

  return (
    <Card title="Developer">
      <View className="gap-2">
        <Button
          label="Debug clock"
          icon="clock-fast"
          variant="secondary"
          testID="home-debug-clock"
          onPress={() => router.push("/dev/clock")}
        />
        {__DEV__ && (
          <>
            <Button
              label="UI preview (dev)"
              icon="palette"
              variant="secondary"
              onPress={() => router.push("/dev/ui")}
            />
            <Button label="Run rollback check (dev)" variant="secondary" onPress={run} />
            {result && <Text className="text-base text-text">{result}</Text>}
          </>
        )}
      </View>
    </Card>
  );
}
