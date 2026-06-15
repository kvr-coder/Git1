# Project: Git1 Mobile

Cross-platform mobile app built with React Native + Expo. Targets Android (primary) and iOS.

## Local paths on the user's PC (Kvara's Windows machine)
- **Dev clone (where the user ships OTAs from)**: `C:\ProgramData\Git1`
- **Manual OTA ship**: `cd C:\ProgramData\Git1` → `git pull` → `npx eas update --branch preview --platform ios --message "..."`
- **Helper script (same thing in one step)**: `scripts\ship-app.bat "what changed"`
- **If `eas` not on PATH**: `npm install -g eas-cli` once.
- **CI OTA workflow** requires `EXPO_TOKEN` in repo secrets (https://expo.dev → Access tokens → paste into github.com/kvr-coder/Git1/settings/secrets/actions). When absent, the workflow fails and the user must ship manually from the path above.

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
Use when the PC is on. Phone connects via LAN (same Wi-Fi as the PC).
1. On the PC: `./scripts/dev-watch.sh`
   - Auto-pulls the current branch every 5s and runs `expo start --lan`
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

## OTA updates — Claude can ship JS/UI changes to the iPhone directly

**The default delivery path: I edit + git push → CI publishes OTA → your phone picks it up.**

Setup (one-time, you):
1. Get a personal access token at https://expo.dev → Settings → Access tokens
2. GitHub → repo `kvr-coder/git1` → Settings → Secrets → Actions → New repository secret:
   - Name: `EXPO_TOKEN`
   - Value: the token from step 1
3. Confirm with a no-op push — `.github/workflows/eas-update.yml` runs, you should see "Publish OTA update" succeed in the Actions tab

After that, any commit to a non-main branch publishes to the `preview` channel; `main` publishes to `production`. **No manual `eas update` needed from your PC unless you want to.**

What I can push via OTA (~1 min, automatic on push):
- Any `.tsx` / `.ts` change in `app/`, `components/`, `lib/`, screens, logic, styles, copy
- New routes, modals, dashboard tweaks
- Bug fixes

What still needs a full `eas build` (~15 min, you trigger):
- New native module (anything added to `package.json` that ships native code)
- Icon, splash, app name, bundle id, or any `app.json` plugin change
- iOS permissions / Info.plist additions
- Version number bump (`expo.version` change → next runtime, OTA won't cross runtimes)

Manual OTA ship from your PC (bypasses CI): `scripts\ship-app.bat "what changed"` — prompts, runs `eas update`, done.

## Git as the backup layer

There is **no external backup service**. Git is the canonical source of truth and the only thing that needs to survive — every other layer rebuilds from it:

- **Code** lives in 3 places at all times: GitHub, the kid PC's clone at `C:\ProgramData\Git1`, and Render's deployed checkout. Lose any one, the other two regenerate it.
- **Server database** (SQLite on Render's ephemeral disk) **can be wiped any time** — every Render redeploy or weekend cold-cycle does. This is OK because:
  - Parent accounts have **deterministic user IDs** derived from email (`u_<sha256(email).slice>`), so re-login after a wipe lands in the same account with all devices intact.
  - Agent tokens are **HMAC-signed with Render's stable service ID** as the key — even with an empty DB, the agent reconnects with its old token, the server verifies the signature, and rebuilds the device row from the token payload. **No re-pairing.** Proven end-to-end (see `server/src/store.ts` `signAgentToken` + `verifyAgentToken`).
- **Agent local state** (used minutes, bank balance, app-seconds, policy cache, clock anchor) lives in JSON files under `C:\Windows\System32\config\systemprofile\AppData\Roaming\Git1\`. Not backed up — but rebuilds itself in <1 day from heartbeats and policy snapshots.
- **OTA bundles** are hosted by Expo's CDN, keyed by `runtimeVersion`. The installed iOS app falls back to its embedded bundle if Expo is unreachable.

Practical implication: **as long as the GitHub repo is intact, nothing is ever lost.** A nuked kid PC re-pairs via a fresh installer in 2 minutes (`scripts/Install-Git1-Kid.bat`). A nuked Render service redeploys from git in ~90 seconds and self-heals all devices on reconnect. A nuked phone reinstalls the timeoff app from TestFlight and signs in with the same email.
