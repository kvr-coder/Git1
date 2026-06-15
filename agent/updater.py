"""Agent self-update: keep the kid-PC agent current via git, so new features
ship by `git push` without touching the machine.

Two triggers (both enabled by default):
  * TIMER     — every GIT1_UPDATE_INTERVAL_MIN minutes, fetch+pull the tracked
                branch; if HEAD moved, re-exec the agent with the new code.
  * SIGNALED  — the server advertises its deployed commit (`repoCommit`) in the
                snapshot; when it differs from ours we pull immediately. Since
                the server redeploys to a new commit on every push, this makes
                a single push update server + agent together.

Safety / control:
  * Disable entirely with GIT1_AUTOUPDATE=0.
  * Tracks GIT1_UPDATE_BRANCH (default: the agent's current branch). This MUST
    be a branch only the parent can push to — whatever lands there runs as
    SYSTEM on the kid's PC. Keep it the same branch the server deploys.
  * Uses `git pull --ff-only` so a divergent local tree never auto-merges.
  * State (usage/policy) is on disk, so re-exec is safe mid-session.
"""
from __future__ import annotations

import os
import subprocess
import sys
import threading
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def _git(args: list[str], timeout: int = 60) -> tuple[int, str]:
    try:
        r = subprocess.run(
            ["git", *args], cwd=str(REPO_ROOT),
            capture_output=True, text=True, timeout=timeout,
        )
        return r.returncode, (r.stdout + r.stderr).strip()
    except Exception as e:  # noqa: BLE001
        return 1, str(e)


def enabled() -> bool:
    return os.environ.get("GIT1_AUTOUPDATE", "1").strip() != "0"


def current_commit() -> str:
    code, out = _git(["rev-parse", "HEAD"])
    return out if code == 0 else ""


def dirty_tracked_files() -> list[str]:
    """Tracked files that differ from the committed code — i.e. someone edited
    the agent's own source. `git status --porcelain` lists changes; we keep
    only modified/deleted TRACKED files (ignore untracked junk like __pycache__).
    A non-empty result is a genuine code-tamper signal."""
    code, out = _git(["status", "--porcelain", "--untracked-files=no"])
    if code != 0 or not out:
        return []
    files = []
    for line in out.splitlines():
        line = line.rstrip()
        if not line:
            continue
        # Format: "XY path" — X/Y are status codes. Skip pure-untracked "??".
        if line.startswith("??"):
            continue
        files.append(line[3:].strip())
    return files


def self_heal_tree() -> bool:
    """Revert any kid edits to tracked files back to the committed version.
    `git checkout -- .` restores all tracked files; the kid's tampering is
    undone without losing the install. Returns True if it ran cleanly."""
    code, _ = _git(["checkout", "--", "."])
    return code == 0


def tracked_branch() -> str:
    b = os.environ.get("GIT1_UPDATE_BRANCH", "").strip()
    if b:
        return b
    code, out = _git(["rev-parse", "--abbrev-ref", "HEAD"])
    return out if code == 0 and out and out != "HEAD" else "main"


def _restart() -> None:
    """Replace the current process with a fresh one running the new code.

    os.execv keeps the same PID, so the NSSM service keeps tracking us; in a
    plain console it simply relaunches. State is persisted to disk so this is
    safe at any time.
    """
    print("[update] restarting agent into new version...")
    sys.stdout.flush()
    try:
        os.execv(sys.executable, [sys.executable, *sys.argv])
    except Exception as e:  # noqa: BLE001
        print(f"[update] execv failed ({e}); exiting so the service restarts us")
        os._exit(42)  # non-zero -> SCM/NSSM recovery brings us back


def pull_and_maybe_restart(reason: str) -> None:
    """Fetch+ff-pull the tracked branch; re-exec if HEAD advanced."""
    if not enabled():
        return
    branch = tracked_branch()
    before = current_commit()
    code, out = _git(["fetch", "origin", branch])
    if code != 0:
        print(f"[update] fetch failed: {out}")
        return
    code, out = _git(["pull", "--ff-only", "origin", branch])
    if code != 0:
        print(f"[update] pull --ff-only failed (divergent tree?): {out}")
        return
    after = current_commit()
    if after and after != before:
        print(f"[update] {reason}: {before[:7]} -> {after[:7]} on {branch}")
        _restart()


def on_server_commit(server_commit: str | None) -> None:
    """Called when a snapshot advertises the server's deployed commit."""
    if not enabled() or not server_commit:
        return
    if current_commit().startswith(server_commit) or server_commit.startswith(current_commit() or "x"):
        return  # already matching
    pull_and_maybe_restart(f"server@{server_commit[:7]} differs")


# Kid-writable trigger file: a NON-admin user can drop this to ask the agent
# (which runs as SYSTEM) to update immediately — no admin rights needed, since
# the agent does the privileged git pull + restart itself.
UPDATE_REQUEST = r"C:\Users\Public\Git1\update.request"


def start_timer() -> None:
    """Background thread that pulls on an interval (the backstop trigger) and
    also watches for a user-dropped update.request file."""
    if not enabled():
        print("[update] auto-update disabled (GIT1_AUTOUPDATE=0)")
        return
    try:
        interval_min = float(os.environ.get("GIT1_UPDATE_INTERVAL_MIN", "20"))
    except ValueError:
        interval_min = 20.0

    def _loop() -> None:
        elapsed = 0.0
        while True:
            time.sleep(5)
            elapsed += 5
            # Fast path: user requested an update via the trigger file.
            try:
                if os.path.exists(UPDATE_REQUEST):
                    os.remove(UPDATE_REQUEST)
                    print("[update] update.request seen -> pulling now")
                    pull_and_maybe_restart("user-request")
            except Exception as e:  # noqa: BLE001
                print(f"[update] request check error: {e}")
            # Backstop: timer interval.
            if interval_min > 0 and elapsed >= interval_min * 60:
                elapsed = 0.0
                pull_and_maybe_restart("timer")

    threading.Thread(target=_loop, name="git1-updater", daemon=True).start()
    print(f"[update] self-update: watching update.request + timer every {interval_min:g} min on {tracked_branch()}")
