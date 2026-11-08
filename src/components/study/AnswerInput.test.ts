// The answer field's keyboard settings (spec 0007 AC-2, AC-9): Gboard ignores autoCorrect={false}
// and swapped "pesron" for "person" on Enter, so meaning questions on Android use the visible
// password keyboard, and the field remounts per question kind so that keyboard never leaks into a
// reading question. Rendered to static markup with react-native stubbed: no device needed.
import { createElement, type ReactElement, type ReactNode } from "react";
// @ts-expect-error react-dom ships no types here (no @types/react-dom); only this one call is used.
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Props = Record<string, unknown>;

const rn = vi.hoisted(() => ({
  os: "android" as string,
  inputs: [] as Record<string, unknown>[],
  children: [] as unknown[],
}));

vi.mock("react-native", () => {
  class Value {
    constructor(public v: number) {}
    setValue(v: number) {
      this.v = v;
    }
  }
  return {
    Platform: {
      get OS() {
        return rn.os;
      },
    },
    TextInput: (props: Props) => {
      rn.inputs.push(props);
      return null;
    },
    Animated: {
      Value,
      View: ({ children }: { children?: ReactNode }) => {
        rn.children.push(children);
        return children;
      },
      timing: () => ({ start: () => {} }),
      sequence: () => ({ start: () => {} }),
    },
    AccessibilityInfo: {
      isReduceMotionEnabled: () => Promise.resolve(false),
      addEventListener: () => ({ remove: () => {} }),
    },
    useColorScheme: () => "light",
  };
});

const { AnswerInput } = await import("./AnswerInput");

function render(kind: "meaning" | "reading", os = "android") {
  rn.os = os;
  rn.inputs.length = 0;
  rn.children.length = 0;
  renderToStaticMarkup(
    createElement(AnswerInput, {
      kind,
      value: "",
      onChangeText: () => {},
      onSubmit: () => {},
      status: "idle",
    }),
  );
  return { props: rn.inputs[0], element: rn.children[0] as ReactElement };
}

beforeEach(() => {
  rn.os = "android";
});

describe("AnswerInput keyboard (spec 0007 AC-2, AC-9)", () => {
  // covers: AC-2, AC-9
  it("uses the visible password keyboard for meaning questions on Android", () => {
    const { props } = render("meaning");
    expect(props.keyboardType).toBe("visible-password");
    expect(props).toMatchObject({
      autoCorrect: false,
      autoComplete: "off",
      spellCheck: false,
      autoCapitalize: "none",
    });
  });

  it("keeps the default keyboard for reading questions, so a kana keyboard still works", () => {
    const { props } = render("reading");
    expect(props.keyboardType).toBe("default");
    expect(props.autoCorrect).toBe(false);
  });

  it("keeps the default keyboard on iOS for both kinds", () => {
    expect(render("meaning", "ios").props.keyboardType).toBe("default");
    expect(render("reading", "ios").props.keyboardType).toBe("default");
  });

  it("keys the field by question kind, so switching kind mounts a fresh field", () => {
    const meaning = render("meaning").element;
    const reading = render("reading").element;
    expect(meaning.key).toBe("meaning");
    expect(reading.key).toBe("reading");
    expect(meaning.key).not.toBe(reading.key);
  });

  it("labels the field by kind and status for screen readers", () => {
    expect(render("meaning").props.accessibilityLabel).toBe("Meaning answer");
    expect(render("reading").props.placeholder).toBe("Type the reading");
  });
});
