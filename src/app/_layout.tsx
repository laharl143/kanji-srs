import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";

import { useDbMigrations } from "@/lib/db/migrate";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Startup work (0001 §3): migrations now; content reseed and reminders land in later features.
  const { ready, error } = useDbMigrations();

  useEffect(() => {
    if (ready || error) SplashScreen.hideAsync();
  }, [ready, error]);

  // A failed open or migration blocks the app so progress is never lost silently (0002 AC-3).
  if (error) return <StartupError error={error} />;
  if (!ready) return null;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </>
  );
}

function StartupError({ error }: { error: Error }) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>The app could not start</Text>
      <Text style={styles.body}>
        The database failed to open or update. Your progress has not been changed.
      </Text>
      <Text selectable style={styles.message}>
        {error.message}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: "600" },
  body: { fontSize: 16 },
  message: { fontSize: 14, fontFamily: "monospace", opacity: 0.8 },
});
