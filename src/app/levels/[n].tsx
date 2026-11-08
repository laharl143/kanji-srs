import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";

import { LoadingState } from "@/components/study/SessionStates";
import { LoadError, NotFound, StageLegend, SubjectTile } from "@/components/subject";
import { Card, Screen } from "@/components/ui";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db/client";
import { parsePositiveParam } from "@/lib/params";
import { getLevelPage, type LevelPage } from "@/lib/study/levels";

const sectionTitles = { radical: "Radicals", kanji: "Kanji", vocab: "Vocabulary" } as const;

// One level's items as type colored tiles with a stage bar (spec 0009 AC-9, AC-11, AC-12).
export default function LevelScreen() {
  const { n } = useLocalSearchParams<{ n: string }>();
  const level = parsePositiveParam(n);
  if (level === null) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Not found" }} />
        <NotFound what="level" />
      </Screen>
    );
  }
  return <LevelView key={level} level={level} />;
}

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "missing" }
  | { status: "ready"; page: LevelPage };

function LevelView({ level }: { level: number }) {
  const [load, setLoad] = useState<Load>({ status: "loading" });

  const refresh = useCallback(() => {
    let active = true;
    getLevelPage(getDb(), getCurrentUserId(), level).then(
      (page) => active && setLoad(page ? { status: "ready", page } : { status: "missing" }),
      (e) =>
        active && setLoad({ status: "error", message: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      active = false;
    };
  }, [level]);
  useFocusEffect(refresh);
  const retry = () => {
    setLoad({ status: "loading" });
    refresh();
  };

  return (
    <Screen>
      <Stack.Screen
        options={{ title: load.status === "missing" ? "Not found" : `Level ${level}` }}
      />
      {load.status === "loading" && <LoadingState label="Loading level" />}
      {load.status === "missing" && <NotFound what="level" />}
      {load.status === "error" && (
        <LoadError title="Level could not load" message={load.message} onRetry={retry} />
      )}
      {load.status === "ready" && (
        <>
          <Text accessibilityRole="header" className="px-1 text-2xl font-bold text-text">
            {`Level ${level}`}
          </Text>
          {load.page.sections.map((section) => (
            <View key={section.type} testID={`level-section-${section.type}`}>
              <Card>
                <View className="flex-row items-center">
                  <Text accessibilityRole="header" className="flex-1 text-lg font-bold text-text">
                    {sectionTitles[section.type]}
                  </Text>
                  <Text className="text-sm text-muted">{`${section.passed}/${section.total} passed`}</Text>
                </View>
                {section.items.length === 0 ? (
                  <Text className="text-base text-muted">None at this level.</Text>
                ) : (
                  <View className="-mx-1 flex-row flex-wrap">
                    {section.items.map((item) => (
                      <SubjectTile
                        key={item.id}
                        item={item}
                        columns={section.type === "vocab" ? 3 : 5}
                      />
                    ))}
                  </View>
                )}
              </Card>
            </View>
          ))}
          <Card title="Stages">
            <StageLegend />
          </Card>
        </>
      )}
    </Screen>
  );
}
