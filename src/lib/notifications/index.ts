import * as Notifications from "expo-notifications";
import { Linking } from "react-native";

import { getCurrentUserId } from "@/lib/auth/current-user";
import { now } from "@/lib/clock";
import { getDb } from "@/lib/db/client";
import { reminderContent } from "@/lib/reminders";
import {
  loadReminderPlan,
  markPermissionAsked,
  reminderTapRoute,
  wasPermissionAsked,
} from "@/lib/study/reminders";

// The thin wrapper that hands the src/lib/reminders plan to expo-notifications (0001 §6.5).
// Local, one shot date notifications only: no push server, no exact alarm permission.

export const REMINDER_CHANNEL_ID = "review-reminders";

// `on`: allowed. `off`: denied (Settings offers Android's app settings). `unasked`: never asked.
export type PermissionState = "on" | "off" | "unasked";

let configured = false;

// Once per app start: how a reminder shows while the app is open, and the Android channel.
export async function configureNotifications(): Promise<void> {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: "Review reminders",
    // eslint-disable-next-line import/namespace -- re-exported with `export *`; tsc checks it
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function getPermissionState(): Promise<PermissionState> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === Notifications.PermissionStatus.GRANTED) return "on";
  return status === Notifications.PermissionStatus.DENIED ? "off" : "unasked";
}

// Shows Android's permission dialog (Android may skip it once you have denied it), then records
// that it was asked. Returns whether notifications are allowed.
export async function requestPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  await markPermissionAsked(getDb());
  return status === Notifications.PermissionStatus.GRANTED;
}

// After your first finished lesson session: asks only if it was never asked (0001 §6.5).
export async function askPermissionOnce(): Promise<void> {
  try {
    if (await wasPermissionAsked(getDb())) return;
    if ((await getPermissionState()) === "on") return markPermissionAsked(getDb());
    await requestPermission();
    await rescheduleReminders();
  } catch (e) {
    console.warn("Notification permission request failed", e);
  }
}

// Android's settings page for this app, where you can turn notifications back on.
export function openAppSettings(): Promise<void> {
  return Linking.openSettings();
}

let chain: Promise<void> = Promise.resolve();

/**
 * Cancels every scheduled reminder and schedules the plan as of `now()` (0001 §6.5 "When to
 * reschedule"). Runs one at a time in call order. Without the permission it only cancels;
 * a failure is logged and never reaches the screen.
 */
export function rescheduleReminders(): Promise<void> {
  chain = chain.then(reschedule, reschedule);
  return chain;
}

async function reschedule(): Promise<void> {
  try {
    await configureNotifications();
    await Notifications.cancelAllScheduledNotificationsAsync();
    if ((await getPermissionState()) !== "on") return;
    const at = now();
    const plan = await loadReminderPlan(getDb(), getCurrentUserId(), at, -at.getTimezoneOffset());
    for (const reminder of plan) {
      await Notifications.scheduleNotificationAsync({
        content: { ...reminderContent(reminder), data: { kind: reminder.kind } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminder.fireAt,
          channelId: REMINDER_CHANNEL_ID,
        },
      });
    }
  } catch (e) {
    console.warn("Could not schedule review reminders", e);
  }
}

// Where a tapped reminder opens: `/reviews` when reviews are due, else Home.
export function tapRoute(): Promise<"/reviews" | "/"> {
  return reminderTapRoute(getDb(), getCurrentUserId(), now());
}
