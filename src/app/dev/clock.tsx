import { Redirect, Stack } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { Button, Card, Screen, useToast } from "@/components/ui";
import { CLOCK_DEBUG_ENABLED, getClockOffset, now, setClockOffset } from "@/lib/clock";
import { getDb } from "@/lib/db/client";

// Debug clock (spec 0004 AC-13): development and e2e builds only; any other build goes Home.
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
    </Screen>
  );
}
