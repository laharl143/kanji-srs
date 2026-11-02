# src/components/ui

The base components every screen builds on. Governing spec: [0003 UI foundation](../../../docs/specs/0003-ui-foundation/index.md). Every component and variant is shown on the dev only preview at `/dev/ui` (`src/app/dev/ui.tsx`); add a new variant there when you add one here.

## Files

Import from the barrel `@/components/ui` (`index.ts`): `Screen`, `AppBar`, `Button`, `Card`, `SubjectChip`, `StageDot`, `ProgressBar`, `ToastProvider` and `useToast`, `ConfirmDialog`.

## Rules

- Style with NativeWind token classes (`bg-surface`, `text-muted`, ...). For a prop that needs a raw color, use `usePalette()` from `@/theme/use-palette`, never a hex literal.
- `Button` takes an optional `testID` for Maestro flows; set one on any button a flow taps.
- Japanese text uses the `font-jp` or `font-jp-bold` class. Fonts may fail to load, so never depend on them for layout.
- Every interactive component needs a TalkBack role, label, and state, a touch target of at least 48dp, and a visible pressed state (AC-5).
- Stage colors and labels come only from `stageGroup` in `@/theme/stage`.
- `ToastProvider` is mounted once in `src/app/_layout.tsx`. It shows one toast at a time (a new one replaces the old) and sits `bottomOffset` plus the bottom inset above the screen edge.
- `ConfirmDialog` cancels on Android back and on a tap outside. With `requireText`, confirm stays disabled until the typed text matches exactly (case sensitive), and the field clears each time the dialog opens.
- Screens pushed over the tabs get the `AppBar` with a back arrow from the root stack; tab screens get it without one.

_Drafted by /sync from the introducing change, worth a quick human pass._
