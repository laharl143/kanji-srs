# 0003. UI foundation

**Date**: 2026-10-13 (updated 2026-11-01 for Android and Expo)
**Status**: In Progress

## Summary

This spec sets the look of the app and the base pieces every screen is built from. It keeps the pink, blue, and purple colorway from `docs/references/ui-inspiration.md`, but builds it the React Native way: NativeWind (Tailwind class names for React Native) with color tokens, Noto Sans JP for Japanese, a bottom tab bar with a solid pink app bar, and nine small hand written components. The app follows your phone's light or dark mode. A development only preview screen shows every component so you can check them on the phone before the real screens use them.

## Requirements

**User stories**:
- As the learner, I want the app to look calm and consistent on my phone, in light and dark mode, so that daily study feels pleasant.
- As the learner, I want radicals, kanji, and vocabulary to have their own colors and items to show their SRS stage at a glance, so that I can read a grid quickly.
- As the builder, I want ready made, accessible base components and one place to see them, so that every later screen is quick to build and looks the same.

**Acceptance criteria**:
- **AC-1**: NativeWind v4 with Tailwind CSS 3.4 is installed and working in Expo Go and in the `preview` APK, and `npm run doctor` still passes. The design tokens (colors, radius, font families, type scale) live as CSS variables in `src/global.css`, with light values under `:root` and dark values under `@media (prefers-color-scheme: dark)`, and are mapped in `tailwind.config.js`. `src/theme/colors.ts` mirrors the same values for places that need a raw color (navigation theme, status bar, icons), and a Vitest test fails if the two ever differ.
- **AC-2**: Colors follow the palette below: blue radicals, pink kanji, purple vocabulary (the same in both themes, white characters on top), a pink app bar with a white title in both themes, and stage colors as `--stage-*` tokens (light and dark) chosen through one pure function `stageGroup(srsStage)` that covers locked (no assignment), lesson (stage 0), Seed (1 to 4), Sprout (5 to 6), Bloom (7), Harvest (8), and Retired (9). `SubjectChip` and `StageDot` show the stage; a locked chip is greyed.
- **AC-3**: Japanese text uses Noto Sans JP Regular and Bold through the `font-jp` and `font-jp-bold` classes. The fonts load at startup while the splash screen is still up. If the fonts fail to load, the app still opens using the system font (font loading never blocks the app).
- **AC-4**: The app shell has a bottom tab bar with Home, Levels, and Settings, each with one pink `AppBar` (no arrow) titled "Kanji SRS", "Levels", and "Settings". Every screen pushed on top of the tabs (lessons, reviews, item page, level detail, credits, the dev preview) shows the pink `AppBar` with its own title and a back arrow, no tab bar, and the Android back button returns to the previous screen. The theme follows the system and switches live when you change it. The layout is edge to edge (drawn behind the system bars) with safe areas respected, light status bar icons over the pink bar, and no horizontal scroll at 360dp width or at a 1.3 font scale (the app bar title and tab labels may truncate with an ellipsis, never wrap or clip).
- **AC-5**: The base components exist in `src/components/ui/`: `Screen`, `AppBar`, `Button`, `Card`, `SubjectChip`, `StageDot`, `ProgressBar`, `Toast` (provider plus `useToast`), and `ConfirmDialog`. Every interactive one has a TalkBack role, label, and state, a touch target of at least 48dp, and a visible pressed state. `Toast` messages are announced to TalkBack. Body text and button labels meet 4.5:1 contrast; large text (bold 18sp or larger, and chip characters) meets 3:1.
- **AC-6**: `ConfirmDialog` closes as a cancel when you press the Android back button or tap outside it. Its scrim covers the whole screen including behind the system bars, and the dialog stays above the keyboard at 360dp. With `requireText` set, the confirm button stays disabled until the typed text matches exactly (case sensitive).
- **AC-7**: A development only preview screen at `/dev/ui` shows every component in every variant, reachable from a link on Home in development builds. In a build without `__DEV__` (the `preview` and `e2e` APKs) the link is absent and opening `/dev/ui` redirects to Home.

## Decision

**Chosen option**: Option 1: NativeWind tokens and a small hand written component set.

Build the UI on NativeWind v4 with CSS variable tokens, a bottom tab shell with a custom pink `AppBar`, Noto Sans JP loaded with `useFonts`, and nine hand written components in `src/components/ui/`.

**Implementation skills**: `tailwind-design-system` (`wshobson/agents`, `.agents/skills/tailwind-design-system/`) · `expo-overview` (`expo/skills`, `.agents/skills/expo-overview/`) · `expo-router` (`expo/skills`, `.agents/skills/expo-router/`) · `vercel-react-native-skills` (`vercel-labs/agent-skills`, `.agents/skills/vercel-react-native-skills/`) · `react-native-best-practices` (`callstackincubator/agent-skills`, `.agents/skills/react-native-best-practices/`)

**Decisions made with your choices** (2026-11-01; you picked bottom tabs, a solid pink bar, the component set, and a hand written toast, and asked for the recommended pick on everything else):

| Decision | Pick | Why | Runner up |
|---|---|---|---|
| Navigation | Bottom tabs: Home, Levels, Settings; every other screen is pushed on the root stack, above the tabs | Standard Android pattern, one thumb reach, sessions stay free of the tab bar | Home hub with no tabs |
| App bar | Custom `AppBar` used as the `header` for both the stack and the tabs, solid pink with a white title | One look everywhere, and a `right` slot for the review stats strip (0004) | Native stack header themed pink |
| Theme | Follow the system only (`userInterfaceStyle: automatic`, already set); no in app override | 0001 §8 says follow the system; an override adds a setting and storage for little gain | A Light / Dark / System setting in 0010 |
| Subject type colors | Same saturated colors in both themes, white characters, characters at 24sp or larger | Keeps the colorway recognizable; large text passes the 3:1 contrast rule | Lighter colors with dark text in dark mode |
| Japanese font | `@expo-google-fonts/noto-sans-jp`, Regular and Bold only, loaded with `useFonts` in the root layout | Works in Expo Go and the APK; two weights keep the APK smaller | Embedding with the `expo-font` config plugin (APK only, no Expo Go) |
| Latin UI font | System font (Roboto) | Native feel, zero size | Noto Sans for everything |
| Icons | `@expo/vector-icons`, the MaterialCommunityIcons set | Ships with Expo, matches the Material reference, no new vendor | `lucide-react-native` |
| Toast | Hand written provider, one message at a time, about 3 seconds, above the tab bar | Themed, tiny, no dependency | `ToastAndroid` |
| Confirm dialog | React Native `Modal` (transparent, fade), with an optional `requireText` field | 0010 needs typed confirmation, which `Alert.alert` cannot do | `Alert.alert` for simple cases |
| Dev preview | `/dev/ui` route that redirects home when `__DEV__` is false | One screen to eyeball every part on a real phone | A Storybook setup (far heavier) |
| Component tests | Pure helpers tested in Vitest; components checked on the phone via `/dev/ui` (and later by Maestro) | Vitest runs in Node and cannot render React Native; adding `jest-expo` is a second test runner | Add `jest-expo` with React Native Testing Library |
| Stage display | `StageDot` (small colored dot) plus a `stage` prop on `SubjectChip`; the dot always sits next to a text label or inside an accessibility label, never color alone | 0008 and 0009 need stage at a glance; color alone fails colorblind users | Stage tinted tiles with no dot |
| Screen specific parts | The review answer field (0004), the hourly forecast bars (0008), and the level picker (0010) are built by their own specs from these tokens; `ConfirmDialog` takes `children` for extra content like the picker | Each has one user; keeping them out keeps this foundation small | A shared `TextField` here |
| Tab back behavior | Expo Router default (`firstRoute`): back from Levels or Settings goes to Home, back from Home leaves the app | Matches standard Android tab apps | `history` |
| App icon and splash image | Leave the current blue scaffold icon and splash image; only the splash background moves to `--bg` | A real icon is a separate design task | Redesign now |

## Feature design

**Data model sketch**: no database change. The UI reads two existing fields: `subjects.type` (`SubjectType`: `"radical" | "kanji" | "vocab"`, not null) and `subjects.characters` (text, not null), and `assignments.srs_stage` (integer 0 to 9; no assignment row means locked).

**Tokens** (`src/global.css`, stored as space separated RGB channels such as `--primary: 233 30 99;` so Tailwind opacity modifiers work, and mapped in `tailwind.config.js` as `rgb(var(--primary) / <alpha-value>)`):

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#fafaf9` | `#1c1917` | page background, splash |
| `--surface` | `#ffffff` | `#292524` | cards, tab bar, dialog |
| `--border` | `#e7e5e4` | `#44403c` | card outline in dark mode, dividers |
| `--text` | `#1c1917` | `#f5f5f4` | body text |
| `--muted` | `#78716c` | `#a8a29e` | secondary text |
| `--primary` | `#d81b60` | `#f06292` | headings, primary button, active tab (light is one shade darker than the reference pink so white button labels and pink text on `--bg` pass 4.5:1) |
| `--on-primary` | `#ffffff` | `#1c1917` | text on a primary button |
| `--appbar` | `#e91e63` | `#ad1457` | app bar background (white bold 20sp title in both; large text, passes 3:1) |
| `--radical` | `#009dec` | `#009dec` | radical chips, review prompt band for radicals |
| `--kanji` | `#e91e63` | `#e91e63` | kanji chips |
| `--vocab` | `#aa00ff` | `#aa00ff` | vocab chips |
| `--correct` | `#15803d` | `#4ade80` | answer feedback, success toast |
| `--wrong` | `#b91c1c` | `#f87171` | answer feedback, error toast, danger button |

**Stage colors** (tokens in `global.css` and `colors.ts` like every other color; `stageGroup(srsStage: number | null)` in `src/theme/stage.ts` is a pure function returning `{ group, label }`, and a static map `stageClasses[group]` in the same file gives the full literal class names such as `"bg-stage-seed"`, because NativeWind cannot read class names built at runtime):

| Input | Group | Label | Token | Light | Dark |
|---|---|---|---|---|---|
| `null` (no assignment) | `locked` | Locked | `--stage-locked` | `#d6d3d1` | `#44403c` |
| `0` | `lesson` | Lesson | `--stage-lesson` | `#78716c` | `#a8a29e` |
| `1` to `4` | `seed` | Seed | `--stage-seed` | `#a16207` | `#ca8a04` |
| `5` to `6` | `sprout` | Sprout | `--stage-sprout` | `#65a30d` | `#84cc16` |
| `7` | `bloom` | Bloom | `--stage-bloom` | `#0d9488` | `#2dd4bf` |
| `8` | `harvest` | Harvest | `--stage-harvest` | `#7c3aed` | `#a78bfa` |
| `9` | `retired` | Retired | `--stage-retired` | `#57534e` | `#e7e5e4` |

Dark values are lighter so every stage color passes 3:1 against dark `--bg`. Any other number throws (a bug, never shown to you).

**Primary meaning**: `primaryMeaning(meanings: Meaning[]): string` in `src/lib/subjects.ts` (pure) returns the first entry with `primary: true`, else the first entry. Callers pass its result to `SubjectChip`.

**Type scale and shape**: Tailwind defaults for Latin text (`text-sm` 14, `text-base` 16, `text-lg` 18, `text-xl` 20, `text-2xl` 24). Japanese sizes for chips: `sm` 24, `md` 32, `lg` 48; the review prompt (0004) uses 64. Radius tokens: `rounded-md` 8, `rounded-lg` 12, `rounded-full`. Side padding 16dp.

**Routes this feature creates** (Expo Router, `src/app/`):
- `_layout.tsx`: root `Stack` with `header: (props) => <AppBar {...props} />` and `<Stack.Screen name="(tabs)" options={{ headerShown: false }} />` so the tabs never get a second bar; waits for migrations and fonts, then hides the splash; wraps everything in the navigation `ThemeProvider` (built from `colors.ts`; React Navigation 7 themes also need a `fonts` object, so spread `DefaultTheme.fonts`) and `ToastProvider`.
- `(tabs)/_layout.tsx`: `Tabs` with `header: (props) => <AppBar {...props} />` (no back arrow on tabs); Home (`index`, title "Kanji SRS", tab label "Home"), Levels (`levels`, "Levels"), Settings (`settings`, "Settings"); icons `home`, `view-grid`, `cog`; active tint `--primary`, inactive tint `--muted`, background `--surface`, labels with `maxFontSizeMultiplier` 1.3; default `backBehavior`.
- `(tabs)/index.tsx`: Home, the current scaffold screen moved here (keeps the dev rollback check), plus a `UI preview (dev)` link when `__DEV__`.
- `(tabs)/levels.tsx`, `(tabs)/settings.tsx`: placeholders ("Coming in feature 10" and "feature 11") until 0009 and 0010 replace them.
- `subjects/[id].tsx`: placeholder that shows the id (title "Item"), so `SubjectChip` links type check under typed routes; 0009 replaces it.
- `dev/ui.tsx`: the preview screen, title "UI preview" (AC-7).

Other routes (`lessons`, `reviews`, `levels/[n]`, `credits`) are created by their own specs and get the `AppBar` from the root stack automatically. **Every screen sets its own title** with `<Stack.Screen options={{ title }} />` (or `Tabs.Screen` options); without it the bar shows the raw route name. `(tabs)/levels.tsx` is `/levels` and `levels/[n].tsx` is `/levels/5`, which do not clash; never add a `levels/index.tsx`, which would. Typed routes regenerate on `expo start`, so start the dev server once after adding a route before the pre-commit `typecheck` runs.

**API surface** (component props; all live in `src/components/ui/`, one file each, plus an `index.ts` that exports them):

| Component | Key props | Behavior | Accessibility | Key errors / edge cases |
|---|---|---|---|---|
| `Screen` | `children`, `scroll = true`, `padded = true`, `bottomInset = true` | `--bg` background, left/right safe area insets always, bottom inset only when `bottomInset` (tab screens pass `false`, since the tab bar already pads it; top belongs to `AppBar`), 16dp padding, `keyboardShouldPersistTaps="handled"` | n/a | content wider than the screen wraps, never scrolls sideways |
| `AppBar` | the navigator's header props (`options.title`, `back`, `navigation`) plus `right?: ReactNode` read from `options.headerRight` | 56dp tall plus top inset, `--appbar` background behind the status bar, white bold 20sp title with `maxFontSizeMultiplier` 1.3; shows the back arrow only when the navigator passes `back` (stack screens, never tabs); arrow calls `navigation.goBack()` | back button role `button`, label "Back", 48dp | long title truncates with an ellipsis on one line |
| `Button` | `label`, `onPress`, `variant: "primary" \| "secondary" \| "danger" = "primary"`, `disabled?`, `loading?`, `icon?: ComponentProps<typeof MaterialCommunityIcons>["name"]` | min height 48dp, label 16sp medium; primary: `--primary` fill, `--on-primary` text; secondary: `--surface` fill, 1dp `--primary` border, `--primary` text; danger: `--wrong` fill, white text; `loading` swaps the icon for a small `ActivityIndicator` and keeps the label; disabled at 40% opacity; pressed state at 85% opacity | role `button`, state `{ disabled, busy: loading }` | `onPress` ignored while `disabled` or `loading` |
| `Card` | `title?`, `children`, `onPress?`, `accessibilityLabel?` | `--surface`, `rounded-lg`, 16dp padding, light shadow in light mode, `--border` outline in dark mode; pressable when `onPress` is set | when pressable: role `button`, label from `accessibilityLabel` else `title` (one of them is required when `onPress` is set, enforced by the prop type) | n/a |
| `SubjectChip` | `subject: { id: number; type: SubjectType; characters: string; meaning: string }`, `stage?: number \| null` (omit to hide stage; `null` means locked), `size: "sm" \| "md" \| "lg" = "md"`, `onPress?` | type color tile, white `font-jp` characters, a `StageDot` in the top left corner when `stage` is given; a locked chip uses `--stage-locked` fill and `--muted` characters; default press pushes `/subjects/[id]` | role `link`, label `"{type} {characters}, {meaning}"` plus `", {stage label}"` when `stage` is given, min 48dp | long vocab shrinks to fit (`adjustsFontSizeToFit`, one line); characters use `maxFontSizeMultiplier={1.5}` |
| `StageDot` | `stage: number \| null`, `size = 10` | a round dot in the stage token color, via `stageGroup` and `stageClasses` | not focusable; callers put the stage label in text or in their accessibility label | an invalid stage throws (from `stageGroup`) |
| `ProgressBar` | `value: number`, `max: number`, `marker?: number` (0 to 1), `color?: "primary" \| "radical" \| "kanji" \| "vocab"`, `label?` | thin rounded bar; a tick at `marker` (0008 uses 0.9) | role `progressbar`, value `{ min: 0, max, now: value }` | `max <= 0` shows an empty bar; value clamped to 0 to max (via pure `progressFraction`) |
| `ToastProvider` / `useToast` | `show(message: string, opts?: { tone?: "info" \| "success" \| "error"; durationMs?: number = 3000 })`; provider prop `bottomOffset = 72` | one toast at a time (a new one replaces the old), `bottomOffset` plus the bottom inset above the screen edge (clears the tab bar), fades in and out; `--surface` background, `--text` message, a 4dp left bar in `--primary` (info), `--correct` (success), or `--wrong` (error) | `accessibilityLiveRegion="polite"` plus `AccessibilityInfo.announceForAccessibility(message)` | `useToast` outside the provider throws a clear error |
| `ConfirmDialog` | `visible`, `title`, `message`, `confirmLabel`, `cancelLabel = "Cancel"`, `tone: "default" \| "danger" = "default"`, `requireText?: string`, `children?: ReactNode` (extra content under the message, such as 0010's level picker), `onConfirm`, `onCancel` | transparent `Modal` with `statusBarTranslucent` and `navigationBarTranslucent` so the scrim covers the system bars, content inside a `KeyboardAvoidingView`; `requireText` shows a `TextInput` (auto focused) and keeps confirm disabled until the text matches exactly; danger tone uses the danger `Button` | dialog title read first; buttons are `Button`s | `onRequestClose` (Android back) and scrim tap call `onCancel`; typed text resets each time it opens |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Any screen render | light or dark token values | system color scheme through NativeWind's `prefers-color-scheme` handling; `colors.ts` picked by `useColorScheme()` for raw values |
| `SubjectChip` | tile color | `subject.type` (`subjects.type`) mapped to `--radical`, `--kanji`, `--vocab` |
| `SubjectChip` | characters, meaning | `subjects.characters`; meaning is `primaryMeaning(subjects.meanings)`, passed by the caller |
| `SubjectChip`, `StageDot` | stage dot, locked look, stage label | `stage` prop from `assignments.srs_stage` (`null` when no row) through `stageGroup()` and `stageClasses` |
| `AppBar` | back arrow shown | the navigator's `back` header prop (present on pushed stack screens only) |
| `SubjectChip` | link target | `/subjects/${subject.id}` |
| `Toast` | position | `bottomOffset` (default 72dp) plus the bottom safe area inset |
| `ProgressBar` | fill width | `progressFraction(value, max)`, a pure helper in `src/theme/progress.ts` |
| `AppBar` | title | the route's `title` screen option, set by each screen (fixed titles listed under Routes) |
| Tab bar | tab labels and icons | fixed in `(tabs)/_layout.tsx` (this spec) |
| `/dev/ui` | sample subjects | a small hard coded fixture in the dev screen (人 kanji, 一 radical, 大人 vocab; open data, no WaniKani content) |
| Splash | background color | `--bg` light and dark values in `app.json` (`expo-splash-screen` plugin `backgroundColor: "#fafaf9"` and `dark: { backgroundColor: "#1c1917" }`); the splash image and app icon stay as they are |

**Key invariants**:
- Every color in a component comes from a token class or `colors.ts`; no hex values inside `src/components/` or `src/app/`.
- `global.css` and `colors.ts` hold identical values (the parity test). The test reads `global.css` with a small regex parser, takes the `:root` block and the `:root` block inside `@media (prefers-color-scheme: dark)`, converts each `R G B` value to hex, and compares every token (stage tokens included) in both themes with `colors.ts`; a token present in one file and missing in the other also fails.
- `stageGroup` and `stageClasses` are the only places that map an SRS stage to a group, label, or color class.
- Class names are always full literals in source (for example through `stageClasses`), never built with string concatenation, so Tailwind can find them.
- Custom fonts are applied only through `font-jp` and `font-jp-bold`; never combine them with `font-bold` or a `fontWeight`, which breaks custom fonts on Android.
- Every pressable has a role, a label (or visible text), and at least 48dp of touch area (`hitSlop` is allowed to reach 48dp).
- Font loading never blocks startup; only migrations do (0002 AC-3).
- `/dev/ui` is unreachable when `__DEV__` is false.

**Security model**: no new data, no network, no secrets. The only gated surface is `/dev/ui`, closed in non development builds.

**Configuration required**: none (no environment variables). New packages, installed with `npx expo install` so versions match SDK 58: `nativewind`, `tailwindcss@^3.4`, `react-native-reanimated` (and `react-native-worklets` if its version needs it), `@expo-google-fonts/noto-sans-jp`, `expo-font`, `@expo/vector-icons` if not already resolvable. Config files:
- `tailwind.config.js`: `content: ["./src/**/*.{ts,tsx}"]`, `presets: [require("nativewind/preset")]`, default `darkMode` (`"media"`), colors mapped as `rgb(var(--token) / <alpha-value>)`, and `fontFamily: { jp: ["NotoSansJP_400Regular"], "jp-bold": ["NotoSansJP_700Bold"] }` (the exact names `useFonts` registers).
- `babel.config.js`: `presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"]` (`nativewind/babel` is a preset, not a plugin), keeping `plugins: [["inline-import", { extensions: [".sql"] }]]`. The React Compiler (`experiments.reactCompiler`) stays on; confirm the app still builds with it.
- `metro.config.js`: push `"sql"` onto `config.resolver.sourceExts` first, then `module.exports = withNativeWind(config, { input: "./src/global.css" })` as the outermost wrapper.
- `nativewind-env.d.ts` at the root containing `/// <reference types="nativewind/types" />`.

**Font loading**: call `useFonts` at the top of `RootLayout`, before any early `return`, alongside `useDbMigrations`. Treat fonts as ready when they load, when they fail, or after a 3 second timeout, whichever comes first; the splash hides once migrations are ready (or failed) and fonts are ready.

**Dev preview gate**: the first line of the `dev/ui.tsx` component is `if (!__DEV__) return <Redirect href="/" />`, before any other hook, and the route sets its title so no raw name flashes.

**Critical test scenarios**:
- Happy path: open `/dev/ui` in Expo Go at 360dp; every component and variant renders, switching the phone to dark mode recolors everything live, and nothing scrolls sideways at a 1.3 font scale, verifies **AC-1**, **AC-2**, **AC-4**, **AC-5**, **AC-7**
- Tokens: the Vitest parity test fails when one value in `colors.ts` is changed, verifies **AC-1**
- Stages: Vitest covers `stageGroup` for `null`, 0, 1, 4, 5, 6, 7, 8, 9 and throws for 10 and -1; `progressFraction` covers `max = 0`, negative values, and values over max; `primaryMeaning` covers a primary that is not first and a list with no primary, verifies **AC-2**, **AC-5**
- Shell: Home shows one bar titled "Kanji SRS" with no arrow; opening `/dev/ui` shows "UI preview" with a back arrow and no tab bar; Android back returns to Home, verifies **AC-4**
- Contrast: white on `--primary` and `--primary` on `--bg` reach 4.5:1 in light mode, and every stage color reaches 3:1 on `--bg` in both themes (a Vitest check over `colors.ts`), verifies **AC-2**, **AC-5**
- Fonts: kanji in a chip render in Noto Sans JP (compare 直 or 骨, whose Japanese and Chinese glyph shapes differ); with the font load forced to fail, the app still opens, verifies **AC-3**
- Dialog: with `requireText="RESET"`, typing `reset` keeps confirm disabled and `RESET` enables it; the Android back button cancels, verifies **AC-6**
- TalkBack: with TalkBack on, each chip reads its type, characters, and meaning, the progress bar reads its value, and a toast is announced, verifies **AC-5**
- Release gate: in the `preview` APK, the Home link is gone and a deep link to `kanjisrs://dev/ui` lands on Home, verifies **AC-7**

## Build plan

Tracer Bullet: first prove that NativeWind, a token, and the shell run end to end on the phone, then thicken.

1. Install NativeWind v4, Tailwind 3.4, and Reanimated with `npx expo install`; add `tailwind.config.js`, `src/global.css` with two tokens (`--bg`, `--primary`), the Babel and Metro changes (keeping the SQL setup), and `nativewind-env.d.ts`; import `global.css` in `src/app/_layout.tsx` and style one line of the Home screen with `bg-bg text-primary`. Check it in Expo Go in both light and dark mode (give the two tokens dark values so the switch is visible), confirm Expo Go still opens with the Reanimated version `npx expo install` picked, run `npm run doctor`, and build a `preview` APK once to prove it there. If NativeWind cannot run on SDK 58, stop and return to `/architect`. Satisfies **AC-1**
2. Fill in every token, stage tokens included (light and dark), and map them in Tailwind; add `src/theme/colors.ts`, the parity test, the contrast check, `src/theme/stage.ts` with `stageGroup`, `stageClasses`, and tests, `src/theme/progress.ts` with `progressFraction` and tests, and `src/lib/subjects.ts` with `primaryMeaning` and tests; set the splash colors in `app.json`. Satisfies **AC-1**, **AC-2**
3. Load Noto Sans JP Regular and Bold with `useFonts` in the root layout (before any early return, with the 3 second timeout), gating the splash on migrations plus fonts; add `font-jp` and `font-jp-bold` to the Tailwind config. Satisfies **AC-3**
4. Build the shell: `Screen`, `AppBar`, the root `Stack` with the `AppBar` header and `(tabs)` header hidden, the navigation `ThemeProvider` from `colors.ts`, `(tabs)/_layout.tsx` with the three tabs and their own `AppBar` header, Home moved into `(tabs)/index.tsx`, the Levels, Settings, and `subjects/[id]` placeholders with titles, and a light status bar; restyle the startup error screen with `colors.ts` so it reads in dark mode. Satisfies **AC-4**
5. Build `Button`, `Card`, `StageDot`, `SubjectChip`, and `ProgressBar`. Satisfies **AC-2**, **AC-5**
6. Build `ToastProvider` with `useToast`, and `ConfirmDialog` with `requireText`; mount `ToastProvider` in the root layout. Satisfies **AC-5**, **AC-6**
7. Build `/dev/ui` (every component, every variant, both tones of dialog, each toast tone, every stage color) and the dev only link on Home, with the redirect when `__DEV__` is false; run the critical test scenarios on the phone. Satisfies **AC-7**, and checks **AC-4**, **AC-5**

## Consequences

**Positive**:
- Every later screen builds from the same tokens and parts, in light and dark, with accessibility handled once.
- No component library, so nothing to keep in step with a third party theme.
- Japanese renders with Japanese glyph shapes on every phone.

**Negative / tradeoffs**:
- The two Noto Sans JP weights add several megabytes to the APK (about 4 to 5 MB each).
- Accessibility and pressed states are hand made, so they rely on the dev preview and TalkBack checks; there are no component render tests in Vitest.
- NativeWind adds a Babel plugin, a Metro wrapper, and Reanimated, all of which an SDK upgrade must keep working.
- The type colors do not change in dark mode, so the bright tiles stand out more against a dark page.

**Neutral**:
- `useFonts` loads fonts at runtime; switching to the `expo-font` config plugin later (to embed them in the APK) is a small change if startup time matters.
- Placeholder routes for Levels, Settings, and the item page exist until 0009 and 0010 replace them.
- The scope's "Done when" changes from 375px and 1280px with keyboard focus to 360dp, a 1.3 font scale, and TalkBack.

## Follow-up

- [ ] After the build, `/sync` should move NativeWind, Noto Sans JP, and the icon set from "Planned, not installed yet" to the installed stack in root `AGENTS.md`, and add a nested `src/components/ui/AGENTS.md` pointer for the component rules (tokens only, 48dp, roles and labels).
- [ ] 0004 (core loop) should build the review prompt band with `--radical`, `--kanji`, or `--vocab` by subject type, use `AppBar`'s `right` slot (`headerRight`) for the stats strip, and build its own answer field from the tokens.
- [ ] 0008 and 0009 should take stage colors only from `stageGroup`, `stageClasses`, `StageDot`, and `SubjectChip`'s `stage` prop; 0010 should put its level picker inside `ConfirmDialog`'s `children`. All three (and 0004) still describe Next.js and are already queued on the scope for their own Android update.
- [ ] A real app icon and splash image (the scaffold's blue ones stay for now).

Decision history (context, options considered, rationale): [rationale.md](rationale.md). Verify steps: [verify.md](verify.md).
