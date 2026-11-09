// The time row (spec 0010 AC-3): a tap opens Android's time dialog at the stored time, OK saves
// HH:MM, Cancel or a dismiss saves nothing, and a disabled row is inert. Rendered to static
// markup with react-native and the picker stubbed.
import { createElement } from "react";
// @ts-expect-error react-dom ships no types here (no @types/react-dom); only this one call is used.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Props = Record<string, unknown>;
type PickerOptions = {
  mode: string;
  value: Date;
  is24Hour?: boolean;
  onChange: (event: { type: string }, date?: Date) => void;
};

const h = vi.hoisted(() => ({
  row: undefined as Props | undefined,
  opened: [] as PickerOptions[],
}));

vi.mock("react-native", () => ({
  Pressable: (props: Props) => {
    h.row = props;
    return null;
  },
  Text: () => null,
}));
vi.mock("@react-native-community/datetimepicker", () => ({
  DateTimePickerAndroid: { open: (options: PickerOptions) => h.opened.push(options) },
}));
vi.mock("@/lib/clock", () => ({ now: () => new Date(2026, 10, 8, 12, 0, 0) }));

const { TimeRow, formatTime } = await import("./TimeRow");

function render(value: string, disabled = false) {
  h.row = undefined;
  const changes: string[] = [];
  renderToStaticMarkup(
    createElement(TimeRow, {
      label: "Summary time",
      value,
      disabled,
      onChange: (t: string) => changes.push(t),
    }),
  );
  return { changes, row: h.row!, tap: () => (h.row!.onPress as () => void)() };
}

beforeEach(() => {
  h.opened.length = 0;
});

describe("TimeRow (spec 0010 AC-3)", () => {
  // covers: AC-3
  it("opens the time dialog at the stored time and follows the phone's 12 or 24 hour setting", () => {
    render("08:15").tap();
    expect(h.opened).toHaveLength(1);
    const options = h.opened[0];
    expect(options.mode).toBe("time");
    expect([options.value.getHours(), options.value.getMinutes()]).toEqual([8, 15]);
    expect(options.is24Hour).toBeUndefined();
  });

  // covers: AC-3
  it("saves the picked time as HH:MM on OK", () => {
    const r = render("08:00");
    r.tap();
    h.opened[0].onChange({ type: "set" }, new Date(2026, 10, 8, 7, 5));
    expect(r.changes).toEqual(["07:05"]);
  });

  // covers: AC-3
  it("saves nothing on Cancel or a dismiss", () => {
    const r = render("08:00");
    r.tap();
    h.opened[0].onChange({ type: "dismissed" }, new Date(2026, 10, 8, 9, 30));
    h.opened[0].onChange({ type: "set" });
    expect(r.changes).toEqual([]);
  });

  // covers: AC-3
  it("is disabled and announced as disabled when its switch is off", () => {
    const { row } = render("08:00", true);
    expect(row.disabled).toBe(true);
    expect(row.accessibilityState).toEqual({ disabled: true });
  });

  it("names the row and its time for screen readers", () => {
    const { row } = render("08:00");
    expect(row.accessibilityRole).toBe("button");
    expect(row.accessibilityLabel).toBe(`Summary time, ${formatTime("08:00")}`);
  });
});

describe("formatTime", () => {
  it("formats the stored time in the locale's hour and minute style", () => {
    const expected = new Date(2026, 10, 8, 20, 5).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    expect(formatTime("20:05")).toBe(expected);
  });
});
