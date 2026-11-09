// Quick taps on the Stepper (spec 0010 AC-4): taps that land before the next render must still
// count. Rendered once to static markup with react-native stubbed, so every captured onPress
// shares the same render, the way fast taps on a device do.
import { createElement } from "react";
// @ts-expect-error react-dom ships no types here (no @types/react-dom); only this one call is used.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

type Props = Record<string, unknown>;

const rn = vi.hoisted(() => ({ buttons: [] as Props[] }));

vi.mock("react-native", () => ({
  Pressable: (props: Props) => {
    rn.buttons.push(props);
    return null;
  },
  Text: () => null,
  View: ({ children }: { children?: unknown }) => children,
  useColorScheme: () => "light",
}));
vi.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));

const { Stepper } = await import("./Stepper");

function render(value: number, min = 1, max = 10) {
  rn.buttons.length = 0;
  const changes: number[] = [];
  renderToStaticMarkup(
    createElement(Stepper, {
      value,
      min,
      max,
      onChange: (n: number) => changes.push(n),
      decreaseLabel: "Fewer",
      increaseLabel: "More",
      valueLabel: "Value",
    }),
  );
  const press = (label: string) =>
    (rn.buttons.find((b) => b.accessibilityLabel === label)!.onPress as () => void)();
  return { changes, plus: () => press("More"), minus: () => press("Fewer") };
}

describe("Stepper quick taps (spec 0010 AC-4)", () => {
  // covers: AC-4
  it("counts every plus tap that lands before the next render", () => {
    const s = render(3);
    for (let i = 0; i < 5; i++) s.plus();
    expect(s.changes).toEqual([4, 5, 6, 7, 8]);
  });

  it("counts every minus tap that lands before the next render", () => {
    const s = render(8);
    for (let i = 0; i < 3; i++) s.minus();
    expect(s.changes).toEqual([7, 6, 5]);
  });

  it("stops at max and min even when the buttons are not disabled yet", () => {
    const up = render(9);
    for (let i = 0; i < 3; i++) up.plus();
    expect(up.changes).toEqual([10]);
    const down = render(2);
    for (let i = 0; i < 3; i++) down.minus();
    expect(down.changes).toEqual([1]);
  });
});
