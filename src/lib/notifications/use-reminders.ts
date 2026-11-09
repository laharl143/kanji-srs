import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { askPermissionOnce, rescheduleReminders, tapRoute } from "./index";

// Root layout only, once startup is ready (0001 §6.5): reschedules now and whenever the app
// returns to the foreground, and opens the right screen when you tap a reminder.
export function useReminders(): void {
  const router = useRouter();

  useEffect(() => {
    void rescheduleReminders();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void rescheduleReminders();
    });
    return () => sub.remove();
  }, []);

  // Covers a tap that started the app and a tap while it runs.
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!response) return;
    const request = response.notification.request;
    if (handled.current === request.identifier) return;
    handled.current = request.identifier;
    if (request.content.data?.kind !== "daily" && request.content.data?.kind !== "due") return;
    Notifications.clearLastNotificationResponse();
    tapRoute().then(
      (route) => router.navigate(route),
      () => router.navigate("/"),
    );
  }, [response, router]);
}

/**
 * Lesson and review screens (0001 §6.5): reschedules when the session ends, and when you leave
 * after answering anything. With `askPermission` (lessons), the first finished session also asks
 * for the notification permission once.
 */
export function useSessionReminders(
  done: boolean,
  answeredAny: boolean,
  { askPermission = false }: { askPermission?: boolean } = {},
): void {
  useEffect(() => {
    if (!done) return;
    if (askPermission) void askPermissionOnce();
    void rescheduleReminders();
  }, [done, askPermission]);

  const answered = useRef(answeredAny);
  useEffect(() => {
    answered.current = answeredAny;
  }, [answeredAny]);
  useEffect(
    () => () => {
      if (answered.current) void rescheduleReminders();
    },
    [],
  );
}
