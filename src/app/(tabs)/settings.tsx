import { MaterialCommunityIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import {
  ResetDialog,
  SettingsCard,
  SkipAheadDialog,
  Stepper,
  SwitchRow,
  TimeRow,
} from "@/components/settings";
import { Button, Card, Screen, useToast } from "@/components/ui";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db/client";
import type { UserSettings } from "@/lib/db/schema";
import {
  BATCH_MAX,
  BATCH_MIN,
  getSettingsPage,
  resetAllProgress,
  saveSettings,
  skipToLevel,
  type SettingsPage,
  type SettingsPatch,
  versionLine,
} from "@/lib/study/settings";
import { usePalette } from "@/theme/use-palette";

const SAVE_FAILED = "Could not save. Try again.";

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; page: SettingsPage };

type Dialog = "none" | "skip" | "reset";

// The Settings tab (spec 0010): Lessons, Reminders, Progress, and About cards on one scroll.
// Loads on every focus. Each control saves at once; saves run one after another in tap order,
// and a failed save puts the control back to the last value the database confirmed.
export default function SettingsScreen() {
  const toast = useToast();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  // What the controls show; ahead of the database while saves are queued.
  const [shown, setShown] = useState<UserSettings>();
  // The last row a save (or the load) returned.
  const confirmed = useRef<UserSettings | undefined>(undefined);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [dialog, setDialog] = useState<Dialog>("none");
  const [busy, setBusy] = useState(false);
  // A second confirm tap can land before `busy` disables the button, so guard with a ref (AC-8).
  const running = useRef(false);

  const refresh = useCallback(() => {
    let active = true;
    getSettingsPage(getDb(), getCurrentUserId()).then(
      (page) => {
        if (!active) return;
        confirmed.current = page.settings;
        setShown(page.settings);
        setLoad({ status: "ready", page });
      },
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

  const save = useCallback(
    (patch: SettingsPatch) => {
      setShown((s) => (s ? { ...s, ...patch } : s));
      queue.current = queue.current.then(async () => {
        let ok = false;
        try {
          const result = await saveSettings(getDb(), getCurrentUserId(), patch);
          if (result.ok) {
            confirmed.current = result.settings;
            ok = true;
          }
        } catch {
          // A DB failure: same toast and roll back as a refused value.
        }
        if (ok) return;
        const last = confirmed.current;
        if (last) {
          const back = Object.fromEntries(
            Object.keys(patch).map((k) => [k, last[k as keyof UserSettings]]),
          );
          setShown((s) => (s ? { ...s, ...back } : s));
        }
        toast.show(SAVE_FAILED, { tone: "error" });
      });
    },
    [toast],
  );

  // Close the dialog first, then toast, so the toast is never hidden under it (AC-8).
  const finish = (message: string, tone: "success" | "error") => {
    running.current = false;
    setBusy(false);
    setDialog("none");
    toast.show(message, { tone });
  };

  const runSkip = async (level: number) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const result = await skipToLevel(getDb(), getCurrentUserId(), level, now());
      if (!result.ok) return finish(SAVE_FAILED, "error");
      finish(`Skipped to level ${result.level}`, "success");
    } catch {
      finish(SAVE_FAILED, "error");
    }
    refresh();
  };

  const runReset = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await resetAllProgress(getDb(), getCurrentUserId(), now());
      finish("Progress reset", "success");
    } catch {
      finish(SAVE_FAILED, "error");
    }
    refresh();
  };

  if (load.status === "error") {
    return (
      <Screen bottomInset={false}>
        <Card title="Settings could not load">
          <Text className="text-base text-muted">{load.message}</Text>
          <Button label="Try again" variant="secondary" testID="settings-retry" onPress={retry} />
        </Card>
      </Screen>
    );
  }
  if (load.status === "loading" || !shown) {
    return (
      <Screen bottomInset={false}>
        <Text className="text-base text-muted">Loading settings…</Text>
      </Screen>
    );
  }

  const { maxLevel, contentVersion } = load.page;
  const level = load.page.settings.currentLevel;
  const atTop = level >= maxLevel;

  return (
    <Screen bottomInset={false}>
      <SettingsCard title="Lessons" testID="settings-lessons">
        <View className="flex-row flex-wrap items-center gap-3">
          <Text className="flex-1 text-base text-text">Lessons per batch</Text>
          <Stepper
            value={shown.lessonBatchSize}
            min={BATCH_MIN}
            max={BATCH_MAX}
            onChange={(n) => save({ lessonBatchSize: n })}
            decreaseLabel="Fewer lessons per batch"
            increaseLabel="More lessons per batch"
            valueLabel="Lessons per batch"
            testID="settings-batch"
          />
        </View>
      </SettingsCard>

      <SettingsCard title="Reminders" testID="settings-reminders">
        <SwitchRow
          label="Daily summary"
          value={shown.reminderDailyEnabled}
          onChange={(v) => save({ reminderDailyEnabled: v })}
          testID="settings-daily"
        />
        <TimeRow
          label="Summary time"
          value={shown.reminderDailyTime}
          disabled={!shown.reminderDailyEnabled}
          onChange={(t) => save({ reminderDailyTime: t })}
          testID="settings-daily-time"
        />
        <SwitchRow
          label="Ping when reviews unlock"
          value={shown.reminderDueEnabled}
          onChange={(v) => save({ reminderDueEnabled: v })}
          testID="settings-due"
        />
        <TimeRow
          label="Quiet from"
          value={shown.quietHoursStart}
          disabled={!shown.reminderDueEnabled}
          onChange={(t) => save({ quietHoursStart: t })}
          testID="settings-quiet-start"
        />
        <TimeRow
          label="Quiet until"
          value={shown.quietHoursEnd}
          disabled={!shown.reminderDueEnabled}
          onChange={(t) => save({ quietHoursEnd: t })}
          testID="settings-quiet-end"
        />
        {shown.quietHoursStart === shown.quietHoursEnd && (
          <Text className="text-base text-muted">Same start and end: no quiet hours</Text>
        )}
      </SettingsCard>

      <SettingsCard title="Progress" testID="settings-progress">
        <View className="gap-2">
          <Text className="text-base font-medium text-text">Skip ahead</Text>
          <Text testID="settings-level" className="text-base text-muted">
            {atTop ? "You are on the highest level" : `You are on level ${level}`}
          </Text>
          <Button
            label="Choose"
            variant="secondary"
            disabled={atTop}
            testID="settings-skip"
            onPress={() => setDialog("skip")}
          />
        </View>
        <View className="h-px bg-border" />
        <Button
          label="Reset all progress"
          variant="danger"
          testID="settings-reset"
          onPress={() => setDialog("reset")}
        />
      </SettingsCard>

      <SettingsCard title="About" testID="settings-about">
        <CreditsRow />
        <Text testID="settings-versions" className="text-sm text-muted">
          {versionLine(Constants.expoConfig?.version, contentVersion)}
        </Text>
      </SettingsCard>

      {dialog === "skip" && (
        <SkipAheadDialog
          currentLevel={level}
          maxLevel={maxLevel}
          busy={busy}
          onConfirm={(n) => void runSkip(n)}
          onCancel={() => setDialog("none")}
        />
      )}
      <ResetDialog
        visible={dialog === "reset"}
        busy={busy}
        onConfirm={() => void runReset()}
        onCancel={() => setDialog("none")}
      />
    </Screen>
  );
}

function CreditsRow() {
  const router = useRouter();
  const palette = usePalette();
  return (
    <Pressable
      testID="settings-credits"
      accessibilityRole="button"
      accessibilityLabel="Credits and licenses"
      onPress={() => router.push("/credits")}
      className="min-h-12 flex-row items-center gap-3 active:opacity-85"
    >
      <MaterialCommunityIcons name="information-outline" size={24} color={palette.primary} />
      <Text className="flex-1 text-base text-text">Credits and licenses</Text>
      <MaterialCommunityIcons name="chevron-right" size={24} color={palette.muted} />
    </Pressable>
  );
}
