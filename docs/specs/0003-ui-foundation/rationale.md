# 0003. UI foundation: rationale

The decision record behind [index.md](index.md).

## Context

Spec 0001 moved the app from Next.js to an Android app built with Expo (2026-11-01). The first version of this spec assumed a browser: `globals.css`, `next/font`, a native `<dialog>`, a top nav that collapses at 375px, and keyboard focus rings. None of that carries over. React Native has no CSS cascade, no `<dialog>`, and no hover, and the phone's own back button, safe areas (the notch and system bar regions), and TalkBack (Android's screen reader) take their place as the things to get right.

Every later screen spec (0004 core loop, 0008 dashboard, 0009 item pages and levels, 0010 settings) names components and colors from this spec: `Button`, `Card`, `SubjectChip`, `ProgressBar`, `Toast`, `ConfirmDialog`, the stage colors, and a "locked" state (0001 `## Follow-up`). 0010 needs a confirm dialog where you type `RESET` before the button works. If the foundation is not settled first, each screen invents its own colors and dialogs and the app drifts.

Forces at play: one developer, phone only (Android, from 360dp wide, 0001 §8), offline, Expo Go during development and an EAS APK for real use. 0001 already chose NativeWind v4 with Tailwind CSS 3.4 and Noto Sans JP via `expo-font`. React Native 0.88 and Expo SDK 58 are newer than NativeWind v4's last widely tested pairing, so the install itself is a risk the build plan proves first. Japanese text on Android falls back to the system CJK font, which can draw some kanji with Chinese glyph shapes, so a bundled Japanese font matters for a kanji app.

The reference screenshots use a Material style: a solid pink app bar, white cards on a light page, a blue review prompt band, and a side drawer.

## Options considered

### Option 1: NativeWind tokens and a small hand written component set

Tokens as CSS variables read by NativeWind; nine components written with React Native core parts (`Pressable`, `Text`, `View`, `Modal`, `TextInput`) and styled with class names.

**Pros**:
- Matches 0001's stack choice and the installed `tailwind-design-system` skill; one styling system everywhere.
- No component library to fight; each part is small, readable, and exactly what the screens need.
- Light and dark come free from the CSS variables, with no theme prop threading.

**Cons**:
- Accessibility, pressed states, and the dialog must be done by hand and checked on the phone.
- NativeWind v4 on React Native 0.88 is a compatibility risk until it is proven.

### Option 2: React Native Paper (Material Design 3 component library)

Use Paper's app bar, buttons, cards, dialogs, snackbars, and progress bars, themed pink.

**Pros**:
- Closest to the Material look in the reference, and dialogs and snackbars are ready made with accessibility done.
- Mature and widely used on Android.

**Cons**:
- Paper has its own theme object, so the app would run two styling systems (Paper's theme and NativeWind classes) that must be kept in step.
- Heavier, and its Material 3 defaults (tonal colors, rounded pills) need overriding to look like this app.

### Option 3: A copy in NativeWind kit (react-native-reusables, shadcn style)

Copy prebuilt components that already use NativeWind class names into the repo.

**Pros**:
- Same styling system as Option 1, with dialogs and accessibility primitives already written.

**Cons**:
- Pulls in `@rn-primitives/*` packages and a portal host, plus its own token names that differ from ours.
- Far more components and code than nine small parts need; more to keep compatible with SDK upgrades.

### Option 4: Plain `StyleSheet` with a TypeScript theme object

No NativeWind; a `theme.ts` with colors per scheme and `useColorScheme()` in every component.

**Pros**:
- No Babel or Metro plugin, so no compatibility risk at all.

**Cons**:
- Reverses 0001's decision and drops the Tailwind skill and conventions.
- Every component threads the theme by hand, and later screens get more verbose.

## Rationale

The deciding force is 0001: it already chose NativeWind so that the Tailwind tokens and the installed Tailwind skill carry into the Android app. Option 2 (Paper) would give ready made Material parts, but it brings a second theme system that has to mirror the NativeWind tokens forever; on a one person project that drift is exactly the kind of thing nobody notices until dark mode looks wrong on one screen. Option 3 solves the same problem as Option 1 with ten times the code. Option 4 removes the only real risk (the NativeWind install) but undoes a decision 0001 made for good reasons. So Option 1 wins, and the build plan proves the NativeWind install first, as a thin thread, before any component work depends on it. If NativeWind v4 cannot run on SDK 58, stop and route back to `/architect` (Option 4 is the fallback) rather than patching around it.

Nine components are enough because the screen specs only ask for these; parts with a single user (the review answer field, the forecast bars, the level picker) stay with their own screen spec. `Screen` and `AppBar` are included because every route needs the same safe area and bar handling, and getting edge to edge right once is cheaper than once per screen. The Material look of the reference is kept through the pink bar, white cards, and the colorway, not through a Material library.

The raw color mirror in `colors.ts` exists because some React Native APIs take a color value, not a class name (the navigation theme background, tab bar tint, status bar, icon colors). Two copies of a palette always drift, so a parity test reads `global.css` and compares it with `colors.ts`, making drift a failing test instead of a visual bug.
