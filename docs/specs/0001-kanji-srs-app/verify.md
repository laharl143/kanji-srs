# Verify: stack & architecture (Expo scaffold) · spec 0001 · updated 2026-11-01
_Steps derived from spec 0001 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [x] Run `npm run dev` on Windows, scan the QR code with Expo Go on your Android phone (use `npx expo start --tunnel` if the firewall blocks it) → the "Kanji SRS / Scaffold is running." screen shows → AC-1
- [x] Run `npx eas-cli@latest login` and `npx eas-cli@latest init` → `app.json` gains `extra.eas.projectId` → AC-6 (setup)
- [x] Run `npx eas-cli@latest build -p android --profile preview`, install the APK, turn on airplane mode, open the app → it opens to the home screen with no errors → AC-6

## Commands
- [x] `npm run typecheck` → exits 0 → tooling carries over
- [x] `npm run lint` → exits 0 → tooling carries over
- [x] `npm test` → exits 0 → tooling carries over
- [x] `npx expo-doctor` → 20/20 checks passed → AC-1
- [x] `npx expo export --platform android` → writes an Android bundle with no errors → AC-1

## Acceptance-criteria coverage
- AC-1 covered by the Expo Go step, `expo-doctor`, and the Android export
- AC-6 covered by the EAS login, init, and preview APK steps (the full lesson plus review session part waits for the core study loop)
- AC-2, AC-3, AC-4, AC-5, AC-7 are not in this scaffold; later features cover them
