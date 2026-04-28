# Project: Git1 Mobile

Cross-platform mobile app built with React Native + Expo. Targets Android (primary) and iOS.

## Stack
- Expo SDK 51 (managed workflow)
- Expo Router (file-based routing in `app/`)
- TypeScript (strict mode)
- React 18 / React Native 0.74

## Commands
- Install deps: `npm install`
- Start dev server (QR for Expo Go): `npm start`
- Run on Android device/emulator: `npm run android`
- Run on iOS simulator (Mac only): `npm run ios`
- Type check: `npm run typecheck`
- Lint: `npm run lint`
- Cloud build for Android APK: `npx eas build -p android --profile preview`
- Cloud build for iOS (no Mac needed): `npx eas build -p ios --profile preview`

## Structure
- `app/` — screens, file-based routing via Expo Router
  - `_layout.tsx` — root navigator
  - `index.tsx` — home screen
- `components/` — reusable UI components (create as needed)
- `assets/` — images, fonts (create as needed)
- `app.json` — Expo config (name, bundle IDs, plugins)

## Conventions
- Functional components with hooks only — no class components
- Styles via `StyleSheet.create`, no inline style objects
- TypeScript strict mode; no `any` unless justified
- Use Expo modules (`expo-*`) before reaching for community packages
- File-based routing: a new screen = a new file in `app/`

## Platform priorities
- **Android is the primary target.** When platform behavior diverges, prefer the Android-correct implementation and note the iOS deviation in a comment.
- Test on Android first via Expo Go (QR scan from `npm start`)
- Verify iOS layout in the simulator or via EAS build before merging

## Preview workflows

There are two ways to preview changes when commands are sent from the phone via Claude Code (web/mobile) and pushed to git.

### Option A — PC-as-dev-server (instant hot reload)
Use when the PC is on. Phone connects from anywhere via tunnel.
1. On the PC: `./scripts/dev-watch.sh`
   - Auto-pulls the current branch every 5s and runs `expo start --tunnel`
2. Open Expo Go on the phone, scan the QR
3. Push from Claude → PC pulls → Metro reloads on the phone

### Option B — EAS Update (no PC needed)
Use when the PC is off; updates take ~30–60s.
1. One-time: install a dev build of the app on the phone
   - `npx eas build --profile development -p android` then install the APK
2. Set `EXPO_TOKEN` in GitHub repo secrets (from expo.dev → access tokens)
3. Push to a branch — `.github/workflows/eas-update.yml` publishes an OTA update
   - `main` → `production` channel; other branches → `preview` channel
4. Open the dev build app on the phone — it pulls the latest bundle

## Build & ship
- Dev iteration: Expo Go (Option A) or dev build + EAS Update (Option B)
- Internal testing: `eas build --profile preview` produces an installable APK
- Production: `eas build --profile production` then submit via `eas submit`
