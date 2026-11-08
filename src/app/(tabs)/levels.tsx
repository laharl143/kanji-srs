import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { StagesCard } from "@/components/home/DashboardCards";
import { LoadingState } from "@/components/study/SessionStates";
import { LoadError } from "@/components/subject";
import { Card, ProgressBar, Screen } from "@/components/ui";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db/client";
import { getLevelsOverview, type LevelRow, type LevelsOverview } from "@/lib/study/levels";

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: LevelsOverview };

// The Levels tab (spec 0009 AC-8, AC-12): Home's stage tiles, then one row per level.
export default function LevelsScreen() {
  const [load, setLoad] = useState<Load>({ status: "loading" });

  const refresh = useCallback(() => {
    let active = true;
    getLevelsOverview(getDb(), getCurrentUserId(), now().getTime()).then(
      (data) => active && setLoad({ status: "ready", data }),
      (e) =>
        active && setLoad({ status: "error", message: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      active = false;
    };
  }, []);
  useFocusEffect(refresh);
  const retry = () => {
    setLoad({ status: "loading" });
    refresh();
  };

  return (
    <Screen bottomInset={false}>
      {load.status === "loading" && <LoadingState label="Loading levels" />}
      {load.status === "error" && (
        <LoadError title="Levels could not load" message={load.message} onRetry={retry} />
      )}
      {load.status === "ready" && (
        <>
          <StagesCard stages={load.data.stages} testID="levels-stages" />
          <Card title="Levels">
            <View testID="levels-list" className="gap-2">
              {load.data.levels.map((row) => (
                <LevelRowItem key={row.level} row={row} current={load.data.currentLevel} />
              ))}
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}

function LevelRowItem({ row, current }: { row: LevelRow; current: number }) {
  const router = useRouter();
  const locked = row.level > current;
  const isCurrent = row.level === current;
  const kanji = row.kanjiTotal === 0 ? "No kanji" : `${row.kanjiPassed} / ${row.kanjiTotal} kanji`;
  const status = isCurrent ? ", current level" : locked ? ", locked" : "";

  return (
    <Pressable
      testID={`level-row-${row.level}`}
      accessibilityRole="button"
      accessibilityLabel={`Level ${row.level}, ${kanji}${row.kanjiTotal === 0 ? "" : " passed"}${status}`}
      onPress={() => router.push({ pathname: "/levels/[n]", params: { n: String(row.level) } })}
      className={`min-h-12 gap-2 rounded-md border px-3 py-3 active:opacity-85 ${isCurrent ? "border-primary" : "border-border"} ${locked ? "opacity-50" : ""}`}
    >
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-base font-bold text-text">{`Level ${row.level}`}</Text>
        {isCurrent && (
          <View className="rounded-full bg-primary px-2 py-0.5">
            <Text className="text-xs font-bold text-on-primary">Current</Text>
          </View>
        )}
        {locked && <Text className="text-sm text-muted">Locked</Text>}
        <Text className="text-sm text-muted">{kanji}</Text>
      </View>
      <View importantForAccessibility="no-hide-descendants">
        <ProgressBar value={row.kanjiPassed} max={row.kanjiTotal} color="kanji" />
      </View>
    </Pressable>
  );
}
