"""Internet kill-switch via Windows Firewall.

Adds two `netsh advfirewall` rules (in + out) named "Git1Block" that drop
all traffic, plus a high-priority allow rule "Git1AllowAgent" for the
agent's Python process so it can still reach the server (without this,
once internet is killed there's no way for the parent to unblock it
remotely — chicken-and-egg lockout).
"""
from __future__ import annotations

import subprocess
import sys

RULE_BLOCK = "Git1Block"
RULE_ALLOW = "Git1AllowAgent"


def _run(args: list[str]) -> tuple[int, str]:
    if sys.platform != "win32":
        return 0, "(noop on non-Windows)"
    try:
        r = subprocess.run(args, capture_output=True, text=True, timeout=10)
        return r.returncode, (r.stdout + r.stderr).strip()
    except Exception as e:
        return 1, str(e)


def is_blocked() -> bool:
    code, out = _run(["netsh", "advfirewall", "firewall", "show", "rule", f"name={RULE_BLOCK}"])
    return code == 0 and "No rules match" not in out


def _ensure_agent_allow() -> None:
    """Add/refresh an allow rule for the agent's python.exe so it can talk
    to the server even while RULE_BLOCK is in place. Allow rules take
    precedence over block rules at the same priority in Windows Firewall.
    """
    py = sys.executable
    if not py:
        return
    # Delete any stale rule first so we don't accumulate them.
    _run(["netsh", "advfirewall", "firewall", "delete", "rule", f"name={RULE_ALLOW}"])
    _run(
        [
            "netsh",
            "advfirewall",
            "firewall",
            "add",
            "rule",
            f"name={RULE_ALLOW}",
            "dir=out",
            "action=allow",
            f"program={py}",
            "enable=yes",
            "profile=any",
        ],
    )


def _remove_agent_allow() -> None:
    _run(["netsh", "advfirewall", "firewall", "delete", "rule", f"name={RULE_ALLOW}"])


def block_internet() -> bool:
    # Always (re)apply the agent allow rule first, even if already blocked,
    # in case the agent path changed.
    _ensure_agent_allow()
    if is_blocked():
        print("[net] already blocked.")
        return True
    ok = True
    for direction in ("in", "out"):
        code, out = _run(
            [
                "netsh",
                "advfirewall",
                "firewall",
                "add",
                "rule",
                f"name={RULE_BLOCK}",
                f"dir={direction}",
                "action=block",
                "enable=yes",
                "remoteip=any",
            ],
        )
        if code != 0:
            ok = False
            print(f"[net] BLOCK ({direction}) FAILED: {out}")
            if "elevation" in out.lower() or "administrator" in out.lower():
                print("[net] *** Agent must be run as Administrator to add firewall rules. ***")
        else:
            print(f"[net] block rule ({direction}) added.")
    return ok


def unblock_internet() -> bool:
    code, out = _run(["netsh", "advfirewall", "firewall", "delete", "rule", f"name={RULE_BLOCK}"])
    _remove_agent_allow()
    if code != 0:
        print(f"[net] UNBLOCK FAILED: {out}")
    else:
        print("[net] block rules removed.")
    return code == 0
