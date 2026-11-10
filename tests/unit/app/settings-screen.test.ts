// The Settings screen's skip and reset confirm (spec 0010 AC-8): a second confirm tap can land
// before `busy` disables the button, so the write must still run once. Rendered once to static
// markup with every child stubbed, so the captured onConfirm closures share one render, the way
// two fast taps on a device do. useState is seeded so the screen renders ready with a dialog open
// (static rendering runs no effects and ignores state updates after the render).
import { createElement, type ReactNode } from "react";
// @ts-expect-error react-dom ships no types here (no @types/react-dom); only this one call is used.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Props = Record<string, unknown>;
type Passthrough = { children?: ReactNode };

const h = vi.hoisted(() => ({
  dialog: "none" as "none" | "skip" | "reset",
  skipProps: undefined as Record<string, unknown> | undefined,
  resetProps: undefined as Record<string, unknown> | undefined,
  toast: { show: (() => {}) as (...args: unknown[]) => void },
  settings: {
    lessonBatchSize: 5,
    reminderDailyEnabled: true,
    reminderDailyTime: "08:00",
    reminderDueEnabled: true,
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
    ankiMode: false,
    currentLevel: 2,
  },
}));

const notif = vi.hoisted(() => ({
  reschedule: (() => Promise.resolve()) as (...args: unknown[]) => Promise<void>,
}));

const study = vi.hoisted(() => ({
  skipToLevel: (() => Promise.resolve()) as (...args: unknown[]) => Promise<unknown>,
  resetAllProgress: (() => Promise.resolve()) as (...args: unknown[]) => Promise<unknown>,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  // Seed the screen's state by its initial value: load → ready, shown → settings, dialog → open.
  const seed = (init: unknown) => {
    if (init && typeof init === "object" && (init as { status?: string }).status === "loading") {
      return {
        status: "ready",
        page: { settings: h.settings, maxLevel: 60, contentVersion: "abc" },
      };
    }
    if (init === undefined) return h.settings;
    if (init === "none") return h.dialog;
    return init;
  };
  return { ...actual, useState: (init: unknown) => actual.useState(seed(init)) };
});

vi.mock("react-native", () => ({
  AppState: { addEventListener: () => ({ remove: () => {} }) },
  Pressable: () => null,
  Text: () => null,
  View: ({ children }: Passthrough) => children,
}));
vi.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
vi.mock("expo-constants", () => ({ default: { expoConfig: { version: "0.1.0" } } }));
vi.mock("expo-router", () => ({
  useFocusEffect: () => {},
  useRouter: () => ({ push: () => {} }),
}));
vi.mock("@/theme/use-palette", () => ({ usePalette: () => ({}) }));
vi.mock("@/components/ui", () => ({
  Button: () => null,
  Card: ({ children }: Passthrough) => children,
  Screen: ({ children }: Passthrough) => children,
  useToast: () => h.toast,
}));
vi.mock("@/components/settings", () => ({
  SettingsCard: ({ children }: Passthrough) => children,
  Stepper: () => null,
  SwitchRow: () => null,
  TimeRow: () => null,
  SkipAheadDialog: (props: Props) => {
    h.skipProps = props;
    return null;
  },
  ResetDialog: (props: Props) => {
    h.resetProps = props;
    return null;
  },
}));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUserId: () => "user-1" }));
vi.mock("@/lib/clock", () => ({ now: () => new Date("2026-11-08T00:00:00Z") }));
vi.mock("@/lib/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/notifications", () => ({
  getPermissionState: () => new Promise(() => {}),
  openAppSettings: () => Promise.resolve(),
  requestPermission: () => Promise.resolve(true),
  rescheduleReminders: (...args: unknown[]) => notif.reschedule(...args),
}));
vi.mock("@/lib/study/settings", () => ({
  BATCH_MIN: 3,
  BATCH_MAX: 20,
  getSettingsPage: () => new Promise(() => {}),
  saveSettings: () => Promise.resolve({ ok: true, settings: h.settings }),
  skipToLevel: (...args: unknown[]) => study.skipToLevel(...args),
  resetAllProgress: (...args: unknown[]) => study.resetAllProgress(...args),
  versionLine: () => "App 0.1.0 · content abc",
}));

const { default: SettingsScreen } = await import("@/app/(tabs)/settings");

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function render(dialog: "skip" | "reset") {
  h.dialog = dialog;
  h.skipProps = undefined;
  h.resetProps = undefined;
  renderToStaticMarkup(createElement(SettingsScreen));
  // Read back through a cast: TypeScript keeps the `undefined` narrowing across the render call.
  const props = (dialog === "skip" ? h.skipProps : h.resetProps) as Props | undefined;
  if (!props) throw new Error(`${dialog} dialog did not render`);
  return props.onConfirm as (level?: number) => void;
}

type Write = (...args: unknown[]) => Promise<unknown>;
let toast: ReturnType<typeof vi.fn<(...args: unknown[]) => void>>;
let skip: ReturnType<typeof vi.fn<Write>>;
let reset: ReturnType<typeof vi.fn<Write>>;
let reschedule: ReturnType<typeof vi.fn<(...args: unknown[]) => Promise<void>>>;

beforeEach(() => {
  reschedule = vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined);
  notif.reschedule = reschedule;
  toast = vi.fn<(...args: unknown[]) => void>();
  h.toast = { show: toast };
  skip = vi.fn<Write>();
  reset = vi.fn<Write>();
  study.skipToLevel = skip;
  study.resetAllProgress = reset;
});

describe("Settings skip ahead confirm (spec 0010 AC-8)", () => {
  // covers: AC-8
  it("runs the skip once when confirm is tapped twice before it finishes", async () => {
    const write = deferred<unknown>();
    skip.mockReturnValue(write.promise);
    const confirm = render("skip");

    confirm(5);
    confirm(5);
    write.resolve({ ok: true, level: 5 });
    await flush();

    expect(skip).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith("Skipped to level 5", { tone: "success" });
  });

  // covers: AC-6
  it("toasts the level it landed on, which can be above the one picked", async () => {
    skip.mockResolvedValue({ ok: true, level: 7 });
    render("skip")(5);
    await flush();
    expect(toast).toHaveBeenCalledWith("Skipped to level 7", { tone: "success" });
  });

  // 0001 §6.5 "When to reschedule": after a skip, the reminders follow the new due times.
  it("reschedules reminders after the skip", async () => {
    skip.mockResolvedValue({ ok: true, level: 5 });
    render("skip")(5);
    await flush();
    expect(reschedule).toHaveBeenCalledTimes(1);
  });

  // covers: AC-8
  it("lets a later confirm run again once the first skip has finished", async () => {
    skip.mockResolvedValue({ ok: true, level: 5 });
    const confirm = render("skip");

    confirm(5);
    await flush();
    confirm(6);
    await flush();

    expect(skip).toHaveBeenCalledTimes(2);
  });

  // covers: AC-8
  it("shows the save failed toast and frees the guard when the skip throws", async () => {
    skip.mockRejectedValueOnce(new Error("db locked")).mockResolvedValue({ ok: true, level: 5 });
    const confirm = render("skip");

    confirm(5);
    await flush();
    expect(toast).toHaveBeenLastCalledWith("Could not save. Try again.", { tone: "error" });

    confirm(5);
    await flush();
    expect(skip).toHaveBeenCalledTimes(2);
  });

  it("shows the save failed toast when the skip is refused", async () => {
    skip.mockResolvedValue({ ok: false, error: "invalid" });
    render("skip")(99);
    await flush();
    expect(toast).toHaveBeenCalledWith("Could not save. Try again.", { tone: "error" });
  });
});

describe("Settings reset confirm (spec 0010 AC-8)", () => {
  // covers: AC-8
  it("runs the reset once when confirm is tapped twice before it finishes", async () => {
    const write = deferred<unknown>();
    reset.mockReturnValue(write.promise);
    const confirm = render("reset");

    confirm();
    confirm();
    write.resolve({ ok: true });
    await flush();

    expect(reset).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith("Progress reset", { tone: "success" });
  });

  // covers: AC-8
  it("shows the save failed toast and frees the guard when the reset throws", async () => {
    reset.mockRejectedValueOnce(new Error("db locked")).mockResolvedValue({ ok: true });
    const confirm = render("reset");

    confirm();
    await flush();
    expect(toast).toHaveBeenLastCalledWith("Could not save. Try again.", { tone: "error" });

    confirm();
    await flush();
    expect(reset).toHaveBeenCalledTimes(2);
    expect(toast).toHaveBeenLastCalledWith("Progress reset", { tone: "success" });
  });
});
