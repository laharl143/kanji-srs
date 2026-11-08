import "@/global.css";

// Weight subpaths, so only Regular and Bold ship (the package root bundles all nine weights).
import { NotoSansJP_400Regular } from "@expo-google-fonts/noto-sans-jp/400Regular";
import { NotoSansJP_700Bold } from "@expo-google-fonts/noto-sans-jp/700Bold";
import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ScrollView, Text, useColorScheme } from "react-native";

import { startJapaneseVoiceCheck } from "@/components/subject/use-japanese-voice";
import { AppBar, ToastProvider } from "@/components/ui";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { CLOCK_DEBUG_ENABLED, loadClockOffset, now } from "@/lib/clock";
import { bundledContent } from "@/lib/content/bundled";
import { runStartup } from "@/lib/content/startup";
import { getDb } from "@/lib/db/client";
import { useDbMigrations } from "@/lib/db/migrate";
import { paletteFor, type Palette } from "@/theme/colors";

SplashScreen.preventAutoHideAsync();
// The speak button's Japanese voice check starts at launch (spec 0009 AC-10).
void startJapaneseVoiceCheck();

const FONT_TIMEOUT_MS = 3000;

function navigationTheme(scheme: string | null | undefined): Theme {
  const p = paletteFor(scheme);
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  return {
    ...base,
    fonts: DefaultTheme.fonts,
    colors: {
      ...base.colors,
      primary: p.primary,
      background: p.bg,
      card: p.surface,
      text: p.text,
      border: p.border,
      notification: p.primary,
    },
  };
}

// Fonts count as ready once they load, fail, or take longer than FONT_TIMEOUT_MS, so a font
// problem never blocks startup (spec 0003 AC-3); the app then uses the system font.
function useFontsReady(): boolean {
  const [loaded, error] = useFonts({ NotoSansJP_400Regular, NotoSansJP_700Bold });
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);
  return loaded || error !== null || timedOut;
}

// After migrations: restore the debug clock offset, then reseed content and unlock the first
// lessons on first launch (spec 0004 AC-5, AC-13). Runs once per app start.
function useContentStartup(migrated: boolean): { ready: boolean; error: Error | undefined } {
  const [state, setState] = useState<{ ready: boolean; error?: Error }>({ ready: false });
  useEffect(() => {
    if (!migrated) return;
    let cancelled = false;
    (async () => {
      const db = getDb();
      if (CLOCK_DEBUG_ENABLED) await loadClockOffset(db);
      await runStartup(db, getCurrentUserId(), bundledContent, now());
    })().then(
      () => !cancelled && setState({ ready: true }),
      (e) =>
        !cancelled &&
        setState({ ready: false, error: e instanceof Error ? e : new Error(String(e)) }),
    );
    return () => {
      cancelled = true;
    };
  }, [migrated]);
  return { ready: state.ready, error: state.error };
}

export default function RootLayout() {
  // Startup work (0001 §3): migrations, content reseed, and fonts; reminders land later.
  const migrations = useDbMigrations();
  const content = useContentStartup(migrations.ready);
  const ready = content.ready;
  const error = migrations.error ?? content.error;
  const fontsReady = useFontsReady();
  const scheme = useColorScheme();

  useEffect(() => {
    if ((ready || error) && fontsReady) SplashScreen.hideAsync();
  }, [ready, error, fontsReady]);

  if (!fontsReady) return null;
  // A failed open, migration, or reseed blocks the app so progress is never lost silently
  // (0002 AC-3, 0004 AC-5).
  if (error) return <StartupError error={error} palette={paletteFor(scheme)} />;
  if (!ready) return null;

  return (
    <ThemeProvider value={navigationTheme(scheme)}>
      <ToastProvider>
        <Stack screenOptions={{ header: (props) => <AppBar {...props} /> }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </ToastProvider>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}

function StartupError({ error, palette }: { error: Error; palette: Palette }) {
  return (
    <ScrollView
      style={{ backgroundColor: palette.bg }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, gap: 12 }}
    >
      <Text style={{ fontSize: 22, fontWeight: "600", color: palette.text }}>
        The app could not start
      </Text>
      <Text style={{ fontSize: 16, color: palette.text }}>
        The database or the bundled content failed to load. Your progress has not been changed.
      </Text>
      <Text selectable style={{ fontSize: 14, fontFamily: "monospace", color: palette.muted }}>
        {error.message}
      </Text>
      <StatusBar style="auto" />
    </ScrollView>
  );
}
