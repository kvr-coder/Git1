"""Internet kill-switch via Windows Firewall.

Uses two `netsh advfirewall` rules (in + out) named "Git1Block" that drop
all traffic. Toggling them is fast and safe; removing the rules restores
normal connectivity.
"""
from __future__ import annotations

import subprocess
import sys

RULE_NAME = "Git1Block"


def _run(args: list[str]) -> tuple[int, str]:
    if sys.platform != "win32":
        return 0, "(noop on non-Windows)"
    try:
        r = subprocess.run(args, capture_output=True, text=True, timeout=10)
        return r.returncode, (r.stdout + r.stderr).strip()
    except Exception as e:
        return 1, str(e)


def is_blocked() -> bool:
    code, out = _run(["netsh", "advfirewall", "firewall", "show", "rule", f"name={RULE_NAME}"])
    return code == 0 and "No rules match" not in out


def block_internet() -> bool:
    if is_blocked():
        return True
    ok = True
    for direction in ("in", "out"):
        code, _ = _run(
            [
                "netsh",
                "advfirewall",
                "firewall",
                "add",
                "rule",
                f"name={RULE_NAME}",
                f"dir={direction}",
                "action=block",
                "enable=yes",
                "remoteip=any",
            ],
        )
        ok = ok and code == 0
    return ok


def unblock_internet() -> bool:
    code, _ = _run(["netsh", "advfirewall", "firewall", "delete", "rule", f"name={RULE_NAME}"])
    return code == 0
