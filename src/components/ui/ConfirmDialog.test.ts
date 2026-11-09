// ConfirmDialog's gates (spec 0010 AC-7, AC-8): confirm waits for the exact typed text and for
// the caller's own reason, and while a write is busy, back, the scrim, and Cancel do nothing.
// Rendered to static markup with react-native stubbed; the typed text is seeded through useState
// because static rendering cannot type.
import { createElement, type ReactNode } from "react";
// @ts-expect-error react-dom ships no types here (no @types/react-dom); only this one call is used.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

type Props = Record<string, unknown>;
type Passthrough = { children?: ReactNode };

const rn = vi.hoisted(() => ({
  typed: "",
  modal: undefined as Props | undefined,
  pressables: [] as Props[],
  inputs: [] as Props[],
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  // DialogBody's only state is the typed text, which starts as "".
  return {
    ...actual,
    useState: (init: unknown) => actual.useState(init === "" ? rn.typed : init),
  };
});

vi.mock("react-native", () => ({
  Modal: (props: Props & Passthrough) => {
    rn.modal = props;
    return props.children;
  },
  Pressable: (props: Props) => {
    rn.pressables.push(props);
    return null;
  },
  KeyboardAvoidingView: ({ children }: Passthrough) => children,
  View: ({ children }: Passthrough) => children,
  Text: () => null,
  TextInput: (props: Props) => {
    rn.inputs.push(props);
    return null;
  },
  ActivityIndicator: () => null,
}));
vi.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
vi.mock("@/theme/use-palette", () => ({ usePalette: () => ({ muted: "#999" }) }));

const { ConfirmDialog } = await import("./ConfirmDialog");

function render(props: Partial<Props> = {}, typed = "") {
  rn.typed = typed;
  rn.modal = undefined;
  rn.pressables.length = 0;
  rn.inputs.length = 0;
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  renderToStaticMarkup(
    createElement(ConfirmDialog, {
      visible: true,
      title: "Reset all progress?",
      message: "Type RESET to confirm.",
      confirmLabel: "Reset",
      onConfirm,
      onCancel,
      ...props,
    }),
  );
  const byId = (id: string) => rn.pressables.find((p) => p.testID === id)!;
  return {
    onConfirm,
    onCancel,
    confirm: byId("confirm-dialog-confirm"),
    cancel: byId("confirm-dialog-cancel"),
    // The scrim is the only pressable without a testID.
    scrim: rn.pressables.find((p) => p.testID === undefined)!,
    back: rn.modal!.onRequestClose as () => void,
    input: rn.inputs[0],
  };
}

describe("ConfirmDialog typed confirmation (spec 0010 AC-7)", () => {
  // covers: AC-7
  it("keeps confirm disabled until anything is typed", () => {
    const d = render({ requireText: "RESET" });
    expect(d.confirm.disabled).toBe(true);
  });

  // covers: AC-7
  it("keeps confirm disabled for the right word in the wrong case", () => {
    const d = render({ requireText: "RESET" }, "reset");
    expect(d.confirm.disabled).toBe(true);
  });

  // covers: AC-7
  it("enables confirm once the exact text is typed", () => {
    const d = render({ requireText: "RESET" }, "RESET");
    expect(d.confirm.disabled).toBe(false);
  });

  it("labels the text field with what to type", () => {
    const d = render({ requireText: "RESET" });
    expect(d.input.accessibilityLabel).toBe("Type RESET to confirm");
  });

  it("shows no text field and an enabled confirm when no text is required", () => {
    const d = render();
    expect(d.input).toBeUndefined();
    expect(d.confirm.disabled).toBe(false);
  });
});

describe("ConfirmDialog confirmDisabled (spec 0010 AC-5)", () => {
  // covers: AC-5
  it("disables confirm for the caller's reason, such as a count still loading", () => {
    const d = render({ confirmDisabled: true });
    expect(d.confirm.disabled).toBe(true);
  });

  it("keeps confirm disabled when the text matches but the caller still blocks it", () => {
    const d = render({ requireText: "RESET", confirmDisabled: true }, "RESET");
    expect(d.confirm.disabled).toBe(true);
  });
});

describe("ConfirmDialog while busy (spec 0010 AC-8)", () => {
  // covers: AC-8
  it("ignores Android back, the scrim, and Cancel", () => {
    const d = render({ busy: true });
    d.back();
    (d.scrim.onPress as () => void)();
    (d.cancel.onPress as () => void)();
    expect(d.onCancel).not.toHaveBeenCalled();
  });

  // covers: AC-8
  it("shows confirm as busy and disables both buttons", () => {
    const d = render({ busy: true });
    expect(d.confirm.disabled).toBe(true);
    expect(d.confirm.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(d.cancel.disabled).toBe(true);
  });

  it("locks the text field", () => {
    const d = render({ busy: true, requireText: "RESET" }, "RESET");
    expect(d.input.editable).toBe(false);
  });

  it("lets back and the scrim cancel when not busy", () => {
    const d = render();
    d.back();
    (d.scrim.onPress as () => void)();
    expect(d.onCancel).toHaveBeenCalledTimes(2);
  });
});
