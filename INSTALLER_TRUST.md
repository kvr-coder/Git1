# Installer trust — shipping the Windows agent without antivirus tripping

The goal: a kid PC owner double-clicks our installer and it **just runs** — no
SmartScreen "unrecognized app" wall, no Defender quarantine, no "this file
was blocked" toast.

This doc is the full plan. It is opinionated on purpose.

---

## 0. The honest diagnosis

The packaging format (EXE vs BAT vs ZIP) is a **secondary** lever. Two things
dominate whether we get flagged:

1. **What the product is.** A parental-monitoring agent is, by category,
   treated as **PUA (Potentially Unwanted Application)** by Defender,
   SmartScreen, and most AV engines. This is true *regardless of packaging*.
2. **What the installer does.** Our current `Install-Git1-Kid.ps1` performs a
   checklist of behaviours that are individually heuristic red flags:
   - self-elevates to admin,
   - **downloads EXEs from the internet and silently runs them** (Python, Git
     via `Invoke-WebRequest` → `Start-Process`),
   - creates a hidden/standard user account,
   - installs a **LocalSystem service + watchdog**,
   - **locks ACLs** so the user can't modify the install dir,
   - registers autorun entries.

   Every one of those is something real malware also does. Stacked together in
   one unsigned script, they light up behavioural AV.
3. **Unsigned + changing hash.** An unsigned binary whose hash changes every
   release never accumulates SmartScreen reputation.

No packaging trick fixes 1–3. The plan below attacks them directly.

---

## 1. Why NOT "ZIP install from BAT"

It feels safer (the archive itself isn't executed at download), but it is
**worse**, not better, for our case:

- **Mark-of-the-Web (MOTW)** propagates to files extracted from a downloaded
  ZIP on modern Windows. When the kid PC runs the extracted `.bat`, Defender +
  **AMSI scan the script live** — and a BAT that downloads/executes EXEs and
  creates accounts is exactly the pattern AMSI exists to catch.
- A `.bat` can never earn **publisher** reputation in SmartScreen; a signed
  EXE can.
- Worse UX: extract → locate → right-click → Run.

**Verdict:** keep the `.bat` (and optionally a ZIP) as a *documented fallback*
for the rare PC where the EXE is blocked — never as the primary path.

Formats that are also off the table:
- **MSIX**: sandboxed; cannot install a LocalSystem service or create local
  accounts. Not viable for a system-level agent.

---

## 2. The plan, ranked by impact

| # | Lever | Impact | Cost | Status |
|---|---|---|---|---|
| 1 | **Authenticode code-signing** (EV preferred, OV acceptable) | 🟢 Huge | ~$250–400/yr EV, ~$100–200/yr OV | **CI scaffold DONE** — add cert secrets to activate |
| 2 | **Stop downloading runtimes at install time** — bundle Python + Git | 🟢 High | dev only | **DONE** (best-effort bundle + fallback) |
| 3 | **Auto-submit each signed release** to Microsoft (and key AV vendors) | 🟡 Medium | free | TODO (manual for now — needs MS-account auth) |
| 4 | **Real publisher identity** — website, privacy policy, support email | 🟡 Medium | low | privacy policy: DONE (`/privacy`) |
| 5 | Keep **Inno Setup EXE** as the primary format | 🟢 already best | — | DONE |
| 6 | Keep `.bat` / ZIP as **fallback only** | 🟡 | — | DONE |

### What's now wired in CI (`release-agent.yml`)

- **Signing step** (`Sign installer`): runs `signtool` on the built EXE, gated on
  `HAS_CODESIGN`. It's a **no-op until** you add two repo secrets:
  `CODESIGN_PFX_BASE64` (your `.pfx`, base64-encoded) and `CODESIGN_PASSWORD`.
  The moment those exist, the next `agent-v*` tag produces a signed installer.
  (EV certs use an HSM/cloud-KMS instead of a `.pfx` — swap the step's auth when
  you get one.)
- **Bundling step** (`Stage bundled runtimes`): builds a self-contained Python
  (embeddable + pip + the agent's deps, with a native-import sanity check) and a
  portable Git (MinGit) into `installer\payload`. It's `continue-on-error`, and
  the `.iss` entries are `skipifsourcedoesntexist`, so a bundling failure simply
  ships the old downloading installer instead of breaking the release.
- **`Install-Git1-Kid.ps1`** auto-detects `{app}\python` / `{app}\git` and uses
  them; if the bundle is missing OR its native deps don't load, it falls back to
  the winget/download path. So a bad bundle can never brick a kid-PC install.

### 2.1 Code-signing (the real fix)

- Buy an **EV Authenticode certificate** under a real legal/publisher name
  (Sectigo, DigiCert, SSL.com). EV gives **instant SmartScreen reputation** —
  no "unknown publisher" gate from the first download. OV is cheaper but has to
  *earn* reputation over days/weeks of installs.
- Sign **both** the installer EXE and any helper binaries.
- Inno Setup signs at compile time via its `SignTool` directive, or we sign the
  output EXE in CI with `signtool.exe`.
- **CI wiring:** add a signing step to `.github/workflows/release-agent.yml`,
  gated on secrets (`CODESIGN_PFX_BASE64`, `CODESIGN_PASSWORD`, or an HSM/cloud
  KMS for EV). The step is a **no-op until the secrets exist**, so the pipeline
  keeps working before the cert arrives.

### 2.2 Bundle Python instead of downloading it

The biggest *behavioural* trigger is "download an EXE and run it silently."

- Ship the **Python embeddable distribution** (a zip of python + stdlib, no
  installer) inside the Inno Setup payload, plus the agent's pip deps vendored
  or installed into that embedded tree at build time.
- The installer then unpacks a self-contained interpreter — **no runtime
  `Invoke-WebRequest` of python.org / git-for-windows**.
- Keep the **git checkout for agent code only** (so OTA self-update via
  `git pull` still works), but git itself can also be bundled (portable git) to
  remove the second runtime download.
- Bonus: installs become **deterministic and offline-capable**.

### 2.3 Submit releases for whitelisting

- Microsoft false-positive / sample submission:
  https://www.microsoft.com/en-us/wdsi/filesubmission
- Add a CI step that POSTs each signed release (or at least pings a reminder)
  so reputation/clearance builds within ~1–3 days of every release.
- Repeat for any AV that a customer reports a block on (most have a vendor
  false-positive portal).

### 2.4 Publisher identity & privacy policy

Legitimate parental tools (Qustodio, Bark, Net Nanny) stay unflagged because
they are **signed, identifiable, and have a public privacy policy + site**.
- **Privacy policy** is live at `https://git1-server.onrender.com/privacy`
  (source: `server/public/privacy.html`, canonical text: `PRIVACY.md`).
- The signing certificate's organisation name should match the site/brand.

---

## 3. Rollout order

1. **Now (no cert needed):**
   - (a) CI signing scaffold (no-op until secrets set). ✅ done
   - (b) Bundle Python + Git; drop runtime downloads. ✅ done
   - (c) Publish + link the privacy policy. ✅ done
2. **When the cert arrives:** add `CODESIGN_PFX_BASE64` + `CODESIGN_PASSWORD`
   repo secrets — signing turns on automatically on the next `agent-v*` tag.
3. **Each release:** auto-submit to Microsoft; watch for vendor false positives.
4. **Ongoing:** keep the unsigned `.bat`/ZIP fallback documented for edge cases.

---

## 4. What this does NOT change

- The agent stays a **git checkout** that self-updates on push (only the
  *runtime acquisition* stops being a live download).
- The recovery story (`Recover-Git1.bat`, safe-mode disarm) is unchanged.
- The separate public `kvr-coder/Downloads` artifact repo is unchanged — signed
  EXEs publish there exactly as today.
</content>
</invoke>
