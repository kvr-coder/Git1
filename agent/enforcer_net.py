"""Internet kill-switch via Windows Firewall — scoped to the CHILD's user SID.

Why this is scoped, not global
------------------------------
The old implementation added a global block-all-outbound rule
("Git1Block"). In Windows Firewall a block rule outranks the program-allow
rule we added for the agent, so blocking internet ALSO killed the agent's
own connection to the server — the parent was then locked out remotely with
no way to send `unblock`.

The correct fix (per Windows Firewall docs) is to scope the block to the
child's logon token using the `localuser` SDDL condition:

    netsh advfirewall firewall add rule name="Git1BlockChild" dir=out \
        action=block localuser="D:(A;;CC;;;<CHILD_SID>)"

Because the rule matches only the child's SID, the agent — which runs as
LocalSystem (S-1-5-18) once installed as a service, or at worst as a
*different* user — keeps full connectivity. The parent can always send
`unblock`. No deadman hack required.

Target SID resolution order:
  1. GIT1_CHILD_SID env var (set by the installer/service)
  2. The SID of the user owning the active console session
  3. The SID of the current process owner (legacy single-user mode)

On startup, `heal_legacy_block()` removes any old global Git1Block rules so a
machine that is *currently* locked out by a prior agent version recovers as
soon as the new agent runs.
"""
from __future__ import annotations

import os
import subprocess
import sys

# New per-SID rule (in + out share the name; we only need outbound).
RULE_BLOCK_CHILD = "Git1BlockChild"

# Legacy global rules from the old implementation — we only ever DELETE these.
LEGACY_RULE_BLOCK = "Git1Block"
LEGACY_RULE_ALLOW = "Git1AllowAgent"


def _run(args: list[str]) -> tuple[int, str]:
    if sys.platform != "win32":
        return 0, "(noop on non-Windows)"
    try:
        r = subprocess.run(args, capture_output=True, text=True, timeout=10)
        return r.returncode, (r.stdout + r.stderr).strip()
    except Exception as e:  # noqa: BLE001
        return 1, str(e)


# ---------- child SID resolution ----------
def _current_user_sid() -> str | None:
    """SID of the account this process runs under."""
    if sys.platform != "win32":
        return None
    try:
        import win32api  # type: ignore
        import win32security  # type: ignore

        user = win32api.GetUserNameEx(win32api.NameSamCompatible)  # DOMAIN\\user
        sid, _, _ = win32security.LookupAccountName(None, user)
        return win32security.ConvertSidToStringSid(sid)
    except Exception:  # noqa: BLE001
        return None


def _console_user_sid() -> str | None:
    """SID of the user owning the active (physical) console session.

    When the agent runs as LocalSystem this is how we find the *child* who is
    actually logged in, rather than blocking SYSTEM itself.
    """
    if sys.platform != "win32":
        return None
    try:
        import win32security  # type: ignore
        import win32ts  # type: ignore

        sess = win32ts.WTSGetActiveConsoleSessionId()
        if sess == 0xFFFFFFFF:
            return None
        user = win32ts.WTSQuerySessionInformation(
            win32ts.WTS_CURRENT_SERVER_HANDLE, sess, win32ts.WTSUserName
        )
        domain = win32ts.WTSQuerySessionInformation(
            win32ts.WTS_CURRENT_SERVER_HANDLE, sess, win32ts.WTSDomainName
        )
        if not user:
            return None
        account = f"{domain}\\{user}" if domain else user
        sid, _, _ = win32security.LookupAccountName(None, account)
        return win32security.ConvertSidToStringSid(sid)
    except Exception:  # noqa: BLE001
        return None


def child_sid() -> str | None:
    return (
        os.environ.get("GIT1_CHILD_SID")
        or _console_user_sid()
        or _current_user_sid()
    )


def _sddl(sid: str) -> str:
    # D:(A;;CC;;;<SID>) — the documented localuser SDDL for firewall rules.
    return f"D:(A;;CC;;;{sid})"


# ---------- public API ----------
def heal_legacy_block() -> None:
    """Remove the old global block rules so a locked-out machine recovers."""
    for direction in ("in", "out"):  # old rule existed in both directions
        _run(["netsh", "advfirewall", "firewall", "delete", "rule", f"name={LEGACY_RULE_BLOCK}", f"dir={direction}"])
    _run(["netsh", "advfirewall", "firewall", "delete", "rule", f"name={LEGACY_RULE_BLOCK}"])
    _run(["netsh", "advfirewall", "firewall", "delete", "rule", f"name={LEGACY_RULE_ALLOW}"])


def _ps(script: str) -> tuple[int, str]:
    """Run a PowerShell snippet (used for the NetSecurity firewall cmdlets,
    which support per-user scoping reliably, unlike `netsh ... localuser=`
    which some Windows builds reject with 'not a valid argument')."""
    if sys.platform != "win32":
        return 0, "(noop)"
    return _run(["powershell", "-NoProfile", "-NonInteractive", "-Command", script])


def is_blocked() -> bool:
    code, out = _ps(
        f"if (Get-NetFirewallRule -DisplayName '{RULE_BLOCK_CHILD}' -ErrorAction SilentlyContinue) {{'YES'}} else {{'NO'}}"
    )
    return code == 0 and "YES" in out


def block_internet() -> bool:
    sid = child_sid()
    if not sid:
        print("[net] could not resolve child SID — refusing to add a global block (would lock parent out).")
        return False
    if is_blocked():
        print("[net] already blocked (child SID).")
        return True
    # Modern, reliable per-user block via New-NetFirewallRule -LocalUser (SDDL).
    # Scoped to the child's SID, so the LocalSystem agent keeps connectivity.
    sddl = _sddl(sid)
    code, out = _ps(
        "New-NetFirewallRule "
        f"-DisplayName '{RULE_BLOCK_CHILD}' "
        "-Direction Outbound -Action Block -Profile Any -Enabled True "
        f"-LocalUser \"{sddl}\" | Out-Null"
    )
    if code != 0:
        print(f"[net] BLOCK FAILED (New-NetFirewallRule): {out}")
        # Fallback to legacy netsh localuser syntax for older builds.
        code2, out2 = _run([
            "netsh", "advfirewall", "firewall", "add", "rule",
            f"name={RULE_BLOCK_CHILD}", "dir=out", "action=block",
            "enable=yes", "profile=any", f"localuser={sddl}",
        ])
        if code2 != 0:
            print(f"[net] netsh fallback also failed: {out2}")
            return False
    print(f"[net] block rule added for child SID {sid}.")
    return True


def unblock_internet() -> bool:
    _ps(f"Remove-NetFirewallRule -DisplayName '{RULE_BLOCK_CHILD}' -ErrorAction SilentlyContinue")
    # Also clear via netsh + any legacy rules, belt and braces.
    _run(["netsh", "advfirewall", "firewall", "delete", "rule", f"name={RULE_BLOCK_CHILD}"])
    heal_legacy_block()
    print("[net] block rule removed.")
    return True
