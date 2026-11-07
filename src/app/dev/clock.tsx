import { Redirect, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { Button, Card, Screen, useToast } from "@/components/ui";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { CLOCK_DEBUG_ENABLED, getClockOffset, now, setClockOffset } from "@/lib/clock";
import { getDb } from "@/lib/db/client";
import { getCurrentLevel, promoteCurrentLevel } from "@/lib/study/dev";

// Debug clock (spec 0004 AC-13) and the progress shortcut (spec 0006 AC-11): development and e2e
// builds only; any other build goes Home.
export default function DevClockRoute() {
  // Home's path is "/": "/index" resolves to +not-found on a cold deep link.
  if (!CLOCK_DEBUG_ENABLED) return <Redirect href="/" />;
  return <DevClockScreen />;
}

const HOUR = 3_600_000;

const steps: { label: string; hours: number; testID: string }[] = [
  { label: "+1 hour", hours: 1, testID: "clock-add-1h" },
  { label: "+4 hours", hours: 4, testID: "clock-add-4h" },
  { label: "+8 hours", hours: 8, testID: "clock-add-8h" },
  { label: "+1 day", hours: 24, testID: "clock-add-1d" },
];

function DevClockScreen() {
  const toast = useToast();
  const [offset, setOffset] = useState(getClockOffset);
  const [busy, setBusy] = useState(false);
  // Your current level, for the shortcut's label; "error" when it could not be read.
  const [level, setLevel] = useState<number | "error">();

  useEffect(() => {
    let active = true;
    getCurrentLevel(getDb(), getCurrentUserId()).then(
      (l) => active && setLevel(l),
      () => active && setLevel("error"),
    );
    return () => {
      active = false;
    };
  }, []);

  async function apply(ms: number) {
    setBusy(true);
    try {
      await setClockOffset(getDb(), ms);
      setOffset(ms);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Could not save the clock", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function promote() {
    setBusy(true);
    try {
      const result = await promoteCurrentLevel(getDb(), getCurrentUserId(), now());
      setLevel(result.level);
      toast.show(
        `Moved ${result.moved} level ${result.level} ${result.moved === 1 ? "item" : "items"} to stage 4, due now.`,
        { tone: "success" },
      );
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Could not move the items", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  const current = now();
  return (
    <Screen>
      <Stack.Screen options={{ title: "Debug clock" }} />
      <Card title="Current time">
        <Text testID="clock-now" className="text-base text-text">
          {current.toLocaleString()}
        </Text>
        <Text testID="clock-offset" className="text-sm text-muted">
          Offset: {offset / HOUR} hours
        </Text>
      </Card>
      <Card title="Move time forward">
        <View className="gap-2">
          {steps.map((s) => (
            <Button
              key={s.testID}
              label={s.label}
              testID={s.testID}
              disabled={busy}
              onPress={() => apply(offset + s.hours * HOUR)}
            />
          ))}
          <Button
            label="Reset"
            variant="secondary"
            testID="clock-reset"
            disabled={busy || offset === 0}
            onPress={() => apply(0)}
          />
        </View>
      </Card>
      <Card title="Progress shortcut">
        <Text className="text-sm text-muted">
          Moves every item at your level that is at stage 0 to 4, lessons included, to stage 4 and
          makes it due now. One correct review then passes it. No review history is written.
        </Text>
        {level === "error" && (
          <Text className="text-sm text-wrong">Your level could not be read.</Text>
        )}
        <Button
          label={
            typeof level === "number"
              ? `Move level ${level} to stage 4`
              : "Move your level to stage 4"
          }
          icon="fast-forward"
          testID="dev-promote-level"
          disabled={busy || typeof level !== "number"}
          onPress={promote}
        />
      </Card>
    </Screen>
  );
}
