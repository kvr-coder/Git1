# timeoff — Windows installer architecture (the "how it actually works" reference)

> Companion to `INSTALLER_TRUST.md` (which is the *why* / anti-antivirus strategy).
> This doc is the *what we built and how it's wired*, so a future reader can pick
> it up cold.
>
> **Last validated: 2026-06-21** — release `agent-v0.0.1` built green end-to-end
> on a Windows runner (bundled Python+Git+nssm, EXE compiled, published,
> downloadable). See "Verified state" below.

---

## 0. TL;DR

A parent installs the Windows agent on a kid PC by downloading **one EXE** (or a
**BAT** fallback) from a permanent URL. The EXE is a thin **Inno Setup** wrapper
that runs a **PowerShell** installer which sets up Python, the agent code, a
locked-down LocalSystem service, a child account, and pairs the device. To stay
antivirus-friendly the installer **bundles its own Python + Git + nssm** instead
of downloading them at setup time, and the build pipeline is **ready to
code-sign** the moment a certificate is added.

The installer is **built by GitHub Actions** on an `agent-v*` tag and **published
to a separate public repo** (`kvr-coder/Downloads`) so anonymous downloads never
hit a login wall.

---

## 1. Distribution model — where the files live

| Artifact | What it is | Source in this repo |
|---|---|---|
| `timeoff-agent-setup.exe` | Inno Setup installer (primary) | built from `installer/timeoff-agent.iss` |
| `timeoff-agent-setup.bat` | One-file script installer (fallback) | copied from `scripts/Install-Git1-Kid-OneFile.bat` |
| `*.sha256` | Checksums for both | generated in CI |

These are **not committed** to this repo. They are **built in CI and published as
release assets** to the **separate public repo `kvr-coder/Downloads`**.

**Why a separate public repo:** historically this source repo was private, so
release assets here would bounce anonymous downloaders to a GitHub sign-in wall.
The Downloads repo is public-by-design (only artifacts, no code). *(Note: this
source repo is now public too, so this is currently belt-and-suspenders — but the
split is harmless and keeps the option open to re-private the source.)*

**Permanent URLs the app/landing page use (always resolve to the latest tag):**
- `https://github.com/kvr-coder/Downloads/releases/latest/download/timeoff-agent-setup.exe`
- `…/timeoff-agent-setup.bat` (+ `.sha256` siblings)

**Stable proxy URLs on our server** (point UI at these, never at GitHub directly —
if the artifact host ever moves, only these constants change):
- `https://git1-server.onrender.com/installer/exe`
- `…/installer/bat`, `…/installer/exe.sha256`, `…/installer/bat.sha256`
- Defined in `server/src/index.ts` (`INSTALLER_URL` etc.); they 302 to the
  Downloads repo.

---

## 2. Build & release pipeline — `.github/workflows/release-agent.yml`

**Trigger:**
- **Primary:** push a tag matching `agent-v*` (e.g. `agent-v1.2.0`). The workflow
  runs from the tagged commit, so the tag's commit must contain the workflow +
  installer files.
- **Secondary:** `workflow_dispatch` (manual "Run workflow" button). ⚠️ **Gotcha:**
  the GitHub UI only shows the button if the workflow exists on the repo's
  **default branch** (currently `claude/test-hub-web-launch-tAo7u`). If it's not
  there, use the tag-push method instead.

**Runner:** `windows-latest`.

**Steps, in order:**
1. **Checkout.**
2. **Resolve version** — from the tag (`agent-vX.Y.Z` → `X.Y.Z`) or the dispatch
   input.
3. **Install Inno Setup** (via Chocolatey).
4. **Stage bundled runtimes** (best-effort, `continue-on-error`) — builds
   `installer\payload\{python,git,nssm}` (see §3).
5. **Build installer** — `ISCC.exe installer\timeoff-agent.iss` → produces
   `installer\Output\timeoff-agent-setup.exe`.
6. **Sign installer** — gated on `HAS_CODESIGN`; **skipped** until signing
   secrets exist (see §6).
7. **Stage BAT fallback** — copies `Install-Git1-Kid-OneFile.bat` →
   `timeoff-agent-setup.bat`, hashes it.
8. **Hash installer** — SHA256 of the (signed, if applicable) EXE.
9. **Publish release to `kvr-coder/Downloads`** — uses the `DOWNLOADS_PAT`
   secret; release tag is `agent-v<version>`.
10. **Microsoft submission reminder** — writes a checklist (portal link, SHA256,
    download URL) to the run summary so you remember to clear false positives.

**To cut a release** (from a machine with push rights — the cloud sandbox can't
push tags):
```
git fetch origin
git tag agent-vX.Y.Z origin/<branch-with-the-code>
git push origin agent-vX.Y.Z
```

---

## 3. Bundled runtimes — the antivirus core

**Problem:** the single biggest AV/SmartScreen heuristic this installer used to
trip was *"download an EXE installer from the internet and silently run it"* — it
did that for Python, Git, and nssm at setup time.

**Fix:** ship self-contained copies **inside the installer**, built at CI time:
- **Python** — the official *embeddable* distribution, with `pip` bootstrapped and
  the agent's `agent/requirements.txt` pre-installed. CI runs a **native-import
  sanity check** (`import win32api, psutil, websockets, PIL, pystray, ntplib,
  requests`) so a broken bundle fails the build rather than shipping.
- **Git** — *MinGit* (portable, no installer).
- **nssm** — the service manager the agent installs itself with.

**How they're shipped:** `installer/timeoff-agent.iss` `[Files]` entries copy
`payload\python`, `payload\git`, `payload\nssm` to `{app}\python`, `{app}\git`,
`{app}\nssm`. All marked **`skipifsourcedoesntexist`** — so if the bundling step
was skipped/failed, the EXE still compiles and the installer falls back to
downloading (nothing breaks).

**How they're used at install time** (`scripts/Install-Git1-Kid.ps1`):
- Auto-detects `{app}\python` and `{app}\git` relative to its own location
  (`{app}\scripts\..`), or via explicit `-PythonHome` / `-GitHome` params.
- Prepends them to `PATH`, **re-prepending after the registry PATH refresh** (a
  subtle bug fixed once — the refresh would otherwise drop them).
- **Verify-or-fallback:** if the bundled Python can't load the native deps, it
  falls back to a full winget/python.org install and reinstalls deps. So a bad
  bundle can **never brick a kid-PC install**.
- nssm: the bundled path is passed to `install-service.ps1` via `-NssmPath`; that
  script prefers bundled/vendored nssm before any download.

**Net effect:** the EXE install path is **download-free** for all three runtimes.
*(The standalone `.bat` fallback path still downloads them — it has no bundled
payload. That's acceptable: the EXE is the primary path.)*

---

## 4. On-PC install flow — `scripts/Install-Git1-Kid.ps1`

The EXE is just an elevated wrapper that runs `Install-Git1-Kid.bat` →
`Install-Git1-Kid.ps1`. That script, from zero:

1. **Requires admin** (the EXE/BAT self-elevate).
2. **Prerequisites** — use bundled Python+Git if present (see §3), else
   winget → direct download. Disables the Windows "App Execution Alias" Python
   stubs that hijack `python.exe` to the Store.
3. **Clone the agent code** to `C:\ProgramData\Git1` (outside the kid's profile),
   then `icacls` lock it so only Administrators/SYSTEM can modify — the kid can't
   tamper with the code.
4. **Install Python deps** (`pip install -r agent/requirements.txt`) — skipped if
   the bundled interpreter already has them and they verify.
5. **Resolve the child account** — detects the *actual* console user (never trusts
   `%USERNAME%`, which UAC changes), creates a Standard account if needed.
6. **Pair** — asks the server for a 6-digit code, prints it, waits up to 5 min for
   the parent to claim it in the dashboard, then writes the signed agent token to
   `…\systemprofile\AppData\Roaming\Git1\agent.json`.
7. **Install the hardened service** via `install-service.ps1` (see §5), passing
   the bundled nssm path.
8. **Verify online** — tails the agent log for `[ws] connected`.
9. **Kid app** — creates Desktop/Start-Menu shortcut to the local dashboard
   (`http://127.0.0.1:17654`) + autostart tray + overlay at the kid's login.
10. **Recovery safety net** — drops `Recover-Git1.bat` (emergency off-switch) and
    `Repair-Pair-Git1.bat` on the Public desktop.

---

## 5. The agent service — `scripts/install-service.ps1`

- Installs the Python agent as a **LocalSystem Windows service** (`Git1Agent`) via
  **nssm** so it starts at boot, a Standard-user kid can't kill it, and the SCM
  auto-restarts it. A SYSTEM **watchdog scheduled task** revives it if the service
  is deleted.
- Bakes the **absolute** Python path into the service config — so the bundled
  interpreter (which is not on the system PATH) is what runs the agent at runtime.
- Wires the **child's user SID** in for the per-SID internet block.
- `-NssmPath` (new) lets the EXE installer hand it the bundled nssm; otherwise it
  checks `scripts/vendor/`, then PATH, then downloads (checksum-verified mirrors).

**Kid dashboard:** served by the agent at `127.0.0.1:17654` from
`server/public/kid.html` (same file the server serves at `/kid`). The agent also
302-redirects `/privacy` → the configured server's policy page so the kid's
privacy link works from localhost.

---

## 6. Code signing — the frictionless-first-run upgrade

Currently **unsigned** → first run shows SmartScreen "Windows protected your PC →
More info → Run anyway". To remove that:

1. Buy an **Authenticode** cert — **EV (~$250–400/yr, recommended)** for instant
   SmartScreen reputation, or **OV (~$100–200/yr)** which earns reputation over
   days. Vendors: Sectigo, SSL.com, DigiCert.
2. Add repo secrets:
   - `CODESIGN_PFX_BASE64` — the `.pfx`, base64-encoded
   - `CODESIGN_PASSWORD` — its password
3. Done — the **Sign installer** step turns on automatically on the next
   `agent-v*` tag (it's gated on `HAS_CODESIGN = secrets.CODESIGN_PFX_BASE64 != ''`).
   It signs with SHA256 + an RFC-3161 timestamp.

*(EV certs use a hardware token / cloud-KMS rather than a `.pfx` — adjust the
signtool invocation in the workflow when you get one. There's a comment marking
the spot.)*

Until then, ship unsigned + **submit each release to Microsoft**
(https://www.microsoft.com/en-us/wdsi/filesubmission) — the run summary gives you
the link + hash. Clears in ~1–3 days.

---

## 7. Secrets & config inventory

| Secret / setting | Purpose | Status |
|---|---|---|
| `DOWNLOADS_PAT` | Publish artifacts to `kvr-coder/Downloads` (fine-grained PAT, Contents: R/W on that repo) | **Set** (2026-06-21) |
| `CODESIGN_PFX_BASE64` + `CODESIGN_PASSWORD` | Sign the EXE | Not set (unsigned for now) |
| `EXPO_TOKEN` | OTA publish (`eas-update.yml`) | Set / working |

**Branches that matter:**
- **Default branch:** `claude/test-hub-web-launch-tAo7u` (governs the
  workflow_dispatch UI).
- **Deploy branch:** `claude/setup-git1-dev-environment-QeNdU` — **Render**
  redeploys the server from it, and **kid PCs `git pull`** agent code from it
  (the agent self-updates every ~20 min / on server-commit-hash change, then
  re-execs).
- **OTA channels:** `main` → `production`, any `claude/**` branch → `preview`
  (`app.json` runtimeVersion = appVersion).

**EAS facts** (see `CLAUDE.md` for the full list): Expo account `expo221`,
project slug `timeoff`, projectId `e8e50263-c2c5-471b-ba0a-1cdb67c4349b`.

---

## 8. Verified state (2026-06-21)

Test release **`agent-v0.0.1`** ran the full pipeline green on `windows-latest`:

- ✅ Bundled runtimes staged (Python embeddable + pip + deps **import check
  passed**, MinGit, nssm)
- ✅ Inno Setup compiled the EXE with the bundled payload
- ⏭️ Sign step **skipped** (no cert secret — correct)
- ✅ Published to `kvr-coder/Downloads`
- ✅ Download URLs resolve: `…/releases/latest/download/timeoff-agent-setup.exe`
  302s to the `agent-v0.0.1` asset; server proxy `/installer/exe` 302s to latest;
  BAT likewise.

This validated the previously-untested-on-Windows bundling (esp. pywin32 inside
an embeddable Python).

---

## 9. Operating cheat-sheet

- **Ship a new installer:** `git tag agent-vX.Y.Z <commit> && git push origin agent-vX.Y.Z`.
- **Turn on signing:** add the two `CODESIGN_*` secrets → next tag is signed.
- **After each unsigned release:** submit the EXE to Microsoft (link in the run summary).
- **Where users download:** the server proxy URLs (`/installer/exe`, `/installer/bat`).
- **If a kid PC is locked out:** `Recover-Git1.bat` on the Public desktop (works offline; safe-mode as last resort).

## 10. Known gaps / things to revisit

- **No signing cert yet** → first-run SmartScreen warning until one is added.
- **`.bat` fallback path still downloads** Python/Git/nssm (only the EXE path is
  bundled). Fine as a fallback; could be addressed by committing vendored binaries.
- **Pinned versions:** Python `3.12.7`, a MinGit version, nssm `2.24` — bump
  periodically in `release-agent.yml` and `Install-Git1-Kid.ps1`.
- **`workflow_dispatch` UI** needs `release-agent.yml` on the default branch to
  show the button; tag-push always works.
</content>
