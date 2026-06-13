# Pushing updates to Git1

## Where to push

**Branch:** `claude/setup-git1-dev-environment-QeNdU`

This single branch is what:
- **Render** redeploys the server from (auto on every push)
- **Every kid PC** pulls from to self-update (agent's auto-updater)

Push to it → server + all paired kid PCs update within ~60 seconds.

## How updates reach the kid PC

The agent's updater has two triggers:

1. **Timer** — every 20 min, `git fetch origin <branch>` + `git pull --ff-only`. If HEAD moved, re-execs into the new code.
2. **Server-signaled** — the server's snapshot includes its deployed commit hash. When it differs from the agent's, the agent pulls immediately. So a push hits both within seconds of Render finishing the redeploy.

Both run as **SYSTEM** on the kid PC; the kid cannot disable them.

## If the repo is private

`git pull` will fail silently and the agent stays on the current version.

**Workflow when you want to ship an update with a private repo:**

1. Push to `claude/setup-git1-dev-environment-QeNdU`
2. Make the repo **public** (Settings → General → Danger Zone)
3. Wait ~1 minute — kid PC pulls the new code
4. Flip back to **private**

Or configure a deploy key/PAT on `C:\ProgramData\Git1` on each kid PC to skip the public window.

## Verifying on a kid PC

What branch is the agent tracking?

```powershell
sc qc Git1Agent
```

Look for `GIT1_UPDATE_BRANCH=...` in the `AppEnvironmentExtra` line.

What commit is the agent on?

```powershell
git -C C:\ProgramData\Git1 rev-parse HEAD
```

## Disable auto-update entirely

Set the service env var `GIT1_AUTOUPDATE=0` and restart `Git1Agent`.
