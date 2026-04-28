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

## Local preview workflow
1. `npm start` on the PC
2. Open Expo Go on the Android phone, scan the QR code
3. Edits hot-reload instantly — no recompile needed for JS/TS changes
4. Recompile (`npm run android`) only when adding native modules

## Build & ship
- Dev iteration: Expo Go (no compile)
- Internal testing: `eas build --profile preview` produces an installable APK
- Production: `eas build --profile production` then submit via `eas submit`
