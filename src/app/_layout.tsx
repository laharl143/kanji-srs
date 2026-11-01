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

import { AppBar, ToastProvider } from "@/components/ui";
import { useDbMigrations } from "@/lib/db/migrate";
import { paletteFor, type Palette } from "@/theme/colors";

SplashScreen.preventAutoHideAsync();

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

export default function RootLayout() {
  // Startup work (0001 §3): migrations and fonts now; content reseed and reminders land later.
  const { ready, error } = useDbMigrations();
  const fontsReady = useFontsReady();
  const scheme = useColorScheme();

  useEffect(() => {
    if ((ready || error) && fontsReady) SplashScreen.hideAsync();
  }, [ready, error, fontsReady]);

  if (!fontsReady) return null;
  // A failed open or migration blocks the app so progress is never lost silently (0002 AC-3).
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
        The database failed to open or update. Your progress has not been changed.
      </Text>
      <Text selectable style={{ fontSize: 14, fontFamily: "monospace", color: palette.muted }}>
        {error.message}
      </Text>
      <StatusBar style="auto" />
    </ScrollView>
  );
}
