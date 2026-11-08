import { Text, View } from "react-native";

import { Card, ProgressBar } from "@/components/ui";
import { DASHBOARD_STAGES, type Dashboard, type DashboardStage } from "@/lib/study/dashboard";
import { groupLabel, stageClasses } from "@/theme/stage";

import { forecastLabel, forecastRowLabel } from "./forecast-label";

const LEVEL_UP_MARK = 0.9;

// Next 24 hours (spec 0008 AC-2): one row per local hour with reviews, plus a running total.
export function ForecastCard({ data, now }: { data: Dashboard | undefined; now: number }) {
  return (
    <View testID="home-forecast">
      <Card title="Next 24 hours">
        {!data ? (
          <Text className="text-base text-muted">Counting…</Text>
        ) : data.forecast.length === 0 ? (
          <Text className="text-base text-muted">No reviews in the next 24 hours.</Text>
        ) : (
          <View>
            {data.forecast.map((row, i) => (
              <View
                key={row.hourStart}
                accessible
                accessibilityLabel={forecastRowLabel(row, now)}
                className={`min-h-12 flex-row items-center gap-3 py-2 ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <Text className="flex-1 text-base text-text">
                  {forecastLabel(row.hourStart, now)}
                </Text>
                <Text className="text-base font-bold text-primary">+{row.count}</Text>
                <Text className="min-w-12 text-right text-base text-muted">{row.runningTotal}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>
    </View>
  );
}

// Level N (spec 0008 AC-3): passed / total per type, the 90% kanji mark, and the kanji still owed.
export function LevelCard({ data }: { data: Dashboard | undefined }) {
  if (!data) {
    return (
      <View testID="home-level">
        <Card title="Level">
          <Text className="text-base text-muted">Counting…</Text>
        </Card>
      </View>
    );
  }
  const { level, radicals, kanji, vocab, kanjiToLevelUp } = data.level;
  return (
    <View testID="home-level">
      <Card title={`Level ${level}`}>
        <View className="gap-3">
          <ProgressBar
            color="radical"
            value={radicals.passed}
            max={radicals.total}
            label={`Radicals: ${radicals.passed} of ${radicals.total} passed`}
          />
          <ProgressBar
            color="kanji"
            value={kanji.passed}
            max={kanji.total}
            marker={LEVEL_UP_MARK}
            label={`Kanji: ${kanji.passed} of ${kanji.total} passed`}
          />
          {kanjiToLevelUp !== null && (
            <Text className="text-base text-text">
              {kanjiToLevelUp === 0
                ? "Enough kanji passed to level up."
                : `${kanjiToLevelUp} more kanji to level up (the line marks 90%).`}
            </Text>
          )}
          <ProgressBar
            color="vocab"
            value={vocab.passed}
            max={vocab.total}
            label={`Vocabulary: ${vocab.passed} of ${vocab.total} passed (does not count toward level up)`}
          />
        </View>
      </Card>
    </View>
  );
}

// Stages (spec 0008 AC-4): five tiles in the 0003 stage colors, zeros included. Two explicit rows
// (3 + 2) instead of flex-wrap, which miscomputes the card height on Android.
export function StagesCard({ data }: { data: Dashboard | undefined }) {
  const rows = [DASHBOARD_STAGES.slice(0, 3), DASHBOARD_STAGES.slice(3)];
  return (
    <View testID="home-stages">
      <Card title="Stages">
        <View className="gap-2">
          {rows.map((row) => (
            <View key={row.join()} className="flex-row gap-2">
              {row.map((group) => (
                <StageTile key={group} group={group} count={data?.stages[group]} />
              ))}
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

function StageTile({ group, count }: { group: DashboardStage; count: number | undefined }) {
  const label = groupLabel(group);
  return (
    <View
      accessible
      accessibilityLabel={count === undefined ? `${label}, loading` : `${label}, ${count} items`}
      className={`min-h-16 flex-1 justify-center rounded-md px-3 py-2 ${stageClasses[group].bg}`}
    >
      <Text className="text-2xl font-bold text-on-primary">
        {count === undefined ? "�" : count}
      </Text>
      <Text numberOfLines={1} adjustsFontSizeToFit className="text-base font-bold text-on-primary">
        {label}
      </Text>
    </View>
  );
}
