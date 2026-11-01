# Verify: UI foundation · spec 0003 · updated 2026-11-01
_Steps derived from spec 0003 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Start with `npm run dev`, open the app in Expo Go on your Android phone, set Display size so the screen is about 360dp wide.

## UI / manual
- [ ] Home opens with one pink bar titled "Kanji SRS", no back arrow, white status bar icons, and a tab bar with Home, Levels, Settings → AC-4
- [ ] Tap Levels and Settings: each shows its own pink bar ("Levels", "Settings") with no arrow and a placeholder line; Android back from either returns to Home, back from Home leaves the app → AC-4
- [ ] On Home, tap "UI preview (dev)": the screen shows "UI preview" with a back arrow and no tab bar; Android back and the arrow both return to Home → AC-4, AC-7
- [ ] On `/dev/ui`, every section renders: 6 buttons, 2 cards, chips in 3 sizes, 7 stage chips, 7 stage dots with labels, 4 progress bars, 3 toast buttons, 2 dialog buttons → AC-5, AC-7
- [ ] Chip colors: 一 is blue (radical), 人 is pink (kanji), 大人 is purple (vocab), white characters; the first stage chip (locked) is grey with muted characters → AC-2
- [ ] Stage dots and chip dots follow the table: Locked grey, Lesson stone, Seed amber, Sprout green, Bloom teal, Harvest violet, Retired dark grey (stage 0, 1, 5, 7, 8, 9 samples) → AC-2
- [ ] Switch the phone to dark mode while `/dev/ui` is open: page, cards, tab bar, and text recolor live with no restart; the app bar turns a darker pink; subject chips keep their colors → AC-1, AC-4
- [ ] Japanese font: 直 and 骨 in the "Regular / Bold" line and in the stage chips use Japanese glyph shapes (compare with a Chinese font sample); the Bold half is visibly bolder → AC-3
- [ ] Set font size to the largest that gives about 1.3 scale: nothing scrolls sideways at 360dp; the app bar title and tab labels stay on one line (they may truncate) → AC-4
- [ ] Press each button: it dims while pressed; Disabled does nothing; Loading shows a spinner and does nothing → AC-5
- [ ] Tap Info, Success, Error toast: one toast at a time above the tab bar area, a pink, green, or red left bar, gone after about 3 seconds; a new tap replaces the old one → AC-5
- [ ] Open the default dialog: the dark scrim covers the whole screen including the status and navigation bars; tap outside the box → it closes and shows "Cancelled" → AC-6
- [ ] Open the RESET dialog: the keyboard opens and the box stays above it; type `reset` → Reset stays disabled; change to `RESET` → Reset enables; press Android back → it cancels; reopen → the field is empty again → AC-6
- [ ] TalkBack on: each chip reads type, characters, meaning (and stage when shown, e.g. "kanji 直, straight, Seed"); progress bars read their value; a toast is announced; the back arrow reads "Back, button" → AC-5
- [ ] Tap any subject chip: an "Item" screen with a back arrow shows the id → AC-4
- [ ] Startup: with the phone offline, a cold start shows the splash in the page color (light `#fafaf9`, dark `#1c1917`) then Home, never a white flash → AC-3
- [ ] Font fail path: temporarily rename the font import in `src/app/_layout.tsx` to a missing font, reload; the app still opens within about 3 seconds using the system font (revert after) → AC-3

## Release build
- [ ] `npx eas-cli@latest build -p android --profile preview` succeeds and the APK installs and opens → AC-1
- [ ] In the preview APK: Home has no "UI preview (dev)" button or Developer card → AC-7
- [ ] In the preview APK: open `kanjisrs://dev/ui` (for example `adb shell am start -d kanjisrs://dev/ui`) → it lands on Home → AC-7

## Commands
- [ ] `npm test` → all pass, including the token parity, contrast, `stageGroup`, `progressFraction`, and `primaryMeaning` tests → AC-1, AC-2, AC-5
- [ ] Change one value in `src/theme/colors.ts` and run `npx vitest run src/theme/colors.test.ts` → the parity test fails (revert after) → AC-1
- [ ] `npm run typecheck` and `npm run lint` → clean → AC-1
- [ ] `npx expo-doctor` → 20/20 (`npm run doctor` fails because expo-doctor is not a dependency) → AC-1
- [ ] `npx expo export --platform android` → bundles; only two Noto Sans JP files (400Regular, 700Bold) in the asset list → AC-1, AC-3

## Value sourcing
- [ ] Theme tokens: switch system theme → class colors and raw colors (tab bar tint, icon colors) switch together → value source: system scheme
- [ ] Chip tile color: same characters with type radical, kanji, vocab give blue, pink, purple → `subject.type`
- [ ] Chip characters and meaning: the TalkBack label matches the sample's characters and meaning → caller props
- [ ] Stage dot and label: stage null, 0, 4, 6, 7, 8, 9 give Locked, Lesson, Seed, Sprout, Bloom, Harvest, Retired → `stageGroup`
- [ ] Back arrow: present on `/dev/ui` and the Item screen, absent on all three tabs → navigator `back` prop
- [ ] Chip link: tapping chip id 2 opens Item 2 → `/subjects/${id}`
- [ ] Toast position: sits above the tab bar zone on a phone with gesture navigation and with 3 button navigation → `bottomOffset` plus bottom inset
- [ ] Progress fill: 3 of 10 is 30%, 12 of 10 is full, max 0 is empty → `progressFraction`
- [ ] App bar title: every screen shows its own title, never a raw route name → screen `title` option
- [ ] Tab labels and icons: home, grid, cog icons with Home, Levels, Settings → `(tabs)/_layout.tsx`
- [ ] Preview samples: 一, 人, 大人, 直 only (open data) → dev fixture
- [ ] Splash color: light and dark splash backgrounds match `--bg` → `app.json`

## Known gaps (owed to `/architect UI foundation`)
- Contrast: these spec palette pairs miss their targets and are recorded as `KNOWN_GAPS` in `src/theme/colors.test.ts`: light white on radical 2.99 (needs 3), light stage-sprout on bg 2.96 (needs 3), stage-locked on bg 1.43 light and 1.70 dark (needs 3, unless locked is exempt as an inactive state), dark white on wrong (danger button label) 2.77 (needs 4.5), dark white on radical 2.99 (needs 3).

## Acceptance criteria coverage
- AC-1: Expo Go and preview APK steps, dark mode switch, `npm test` parity, typecheck, lint, expo-doctor, export
- AC-2: chip colors, stage dots, Vitest stage and contrast tests (with the known gaps)
- AC-3: Japanese glyph check, Bold check, splash, font fail path, export asset list
- AC-4: tabs, titles, back arrow, Android back, 1.3 font scale, Item screen
- AC-5: buttons, toasts, TalkBack, contrast test
- AC-6: both dialogs, scrim, keyboard, RESET typing, back cancels
- AC-7: dev link, preview screen, preview APK without the link, deep link redirect
