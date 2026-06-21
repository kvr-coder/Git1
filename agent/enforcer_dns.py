"""Web content filter — blocks adult / dangerous sites via family DNS.

Strategy (deliberately DNS-based, not a packet/URL filter):
  * Point every active network adapter at a family-filtering resolver that
    blocks adult + malware/phishing categories (default: Cloudflare for
    Families, 1.1.1.3 / 1.0.0.3). The resolver maintains the category lists —
    we get instant, system-wide coverage for ~zero maintenance.
  * Disable browser DNS-over-HTTPS (Chrome/Edge) via machine policy, since DoH
    would otherwise tunnel around the DNS filter. (VPN/Tor — the other bypass —
    is already detected by enforcer_vpn.)

Re-asserted periodically so a standard-user kid can't quietly switch DNS back.
Reverts adapters to DHCP when the parent turns the filter off.

Windows-only; a no-op elsewhere so the agent still runs in dev.
"""
from __future__ import annotations

import subprocess
import sys
import time

# Family-filtering resolvers. Each blocks adult + malware/phishing categories.
RESOLVERS: dict[str, dict[str, list[str]]] = {
    # Cloudflare for Families — malware + adult. Free, fast, no account.
    "cloudflare": {
        "v4": ["1.1.1.3", "1.0.0.3"],
        "v6": ["2606:4700:4700::1113", "2606:4700:4700::1003"],
    },
    # CleanBrowsing Family filter.
    "cleanbrowsing": {
        "v4": ["185.228.168.168", "185.228.169.168"],
        "v6": ["2a0d:2a00:1::", "2a0d:2a00:2::"],
    },
    # OpenDNS FamilyShield.
    "opendns": {
        "v4": ["208.67.222.123", "208.67.220.123"],
        "v6": [],
    },
}
DEFAULT_RESOLVER = "cloudflare"

# Re-assert at most this often when nothing changed (netsh is slow-ish).
_REASSERT_SEC = 300

_state: dict[str, object] = {
    "enabled": False,
    "resolver": DEFAULT_RESOLVER,
    "applied": None,     # last (enabled, resolver) tuple actually pushed to the OS
    "last_apply": 0.0,
}


def set_web_filter(enabled: bool, resolver: str | None = None) -> None:
    """Record the parent's desired state (applied on the next enforce())."""
    _state["enabled"] = bool(enabled)
    if resolver and resolver in RESOLVERS:
        _state["resolver"] = resolver


def _run(args: list[str]) -> bool:
    try:
        r = subprocess.run(args, capture_output=True, text=True, timeout=20)
        return r.returncode == 0
    except Exception as e:  # noqa: BLE001
        print(f"[dns] cmd failed {args[:3]}...: {e}")
        return False


def _connected_adapters() -> list[str]:
    """Names of connected network interfaces (parsed from netsh)."""
    names: list[str] = []
    try:
        out = subprocess.run(
            ["netsh", "interface", "show", "interface"],
            capture_output=True, text=True, timeout=15,
        ).stdout
        for line in out.splitlines():
            # Columns: Admin State | State | Type | Interface Name
            parts = line.split()
            if len(parts) >= 4 and parts[1].lower() == "connected":
                name = line.split(parts[2], 1)[-1].strip()
                if name:
                    names.append(name)
    except Exception as e:  # noqa: BLE001
        print(f"[dns] adapter enumeration failed: {e}")
    return names


def _set_dns(adapter: str, v4: list[str], v6: list[str]) -> None:
    if v4:
        _run(["netsh", "interface", "ipv4", "set", "dns",
              f"name={adapter}", "static", v4[0], "primary", "no"])
        for i, ip in enumerate(v4[1:], start=2):
            _run(["netsh", "interface", "ipv4", "add", "dns",
                  f"name={adapter}", ip, f"index={i}"])
    if v6:
        _run(["netsh", "interface", "ipv6", "set", "dns",
              f"name={adapter}", "static", v6[0], "primary", "no"])
        for i, ip in enumerate(v6[1:], start=2):
            _run(["netsh", "interface", "ipv6", "add", "dns",
                  f"name={adapter}", ip, f"index={i}"])


def _revert_dns(adapter: str) -> None:
    _run(["netsh", "interface", "ipv4", "set", "dns", f"name={adapter}", "dhcp"])
    _run(["netsh", "interface", "ipv6", "set", "dns", f"name={adapter}", "dhcp"])


def _set_doh(disable: bool) -> None:
    """Disable (or clear) browser DNS-over-HTTPS via machine policy, so DoH can't
    tunnel around the DNS filter. Best-effort."""
    keys = [
        r"HKLM\SOFTWARE\Policies\Google\Chrome",
        r"HKLM\SOFTWARE\Policies\Microsoft\Edge",
    ]
    for k in keys:
        if disable:
            _run(["reg", "add", k, "/v", "DnsOverHttpsMode", "/t", "REG_SZ",
                  "/d", "off", "/f"])
        else:
            _run(["reg", "delete", k, "/v", "DnsOverHttpsMode", "/f"])


def enforce() -> None:
    """Apply the desired state to the OS. Cheap no-op when already in the desired
    state and re-asserted recently. Call this from the agent's main loop."""
    if sys.platform != "win32":
        return
    enabled = bool(_state["enabled"])
    resolver = str(_state["resolver"])
    desired = (enabled, resolver)
    now = time.time()
    fresh = (now - float(_state["last_apply"])) < _REASSERT_SEC
    if desired == _state["applied"] and fresh:
        return  # steady state, recently re-asserted

    if enabled:
        cfg = RESOLVERS.get(resolver, RESOLVERS[DEFAULT_RESOLVER])
        for ad in _connected_adapters():
            _set_dns(ad, cfg["v4"], cfg["v6"])
        _set_doh(True)
        print(f"[dns] web filter ON ({resolver})")
    else:
        # Only actively revert when we just transitioned off (avoid stomping
        # DHCP every re-assert when already disabled).
        if _state["applied"] is not None and _state["applied"][0]:
            for ad in _connected_adapters():
                _revert_dns(ad)
            _set_doh(False)
            print("[dns] web filter OFF (reverted to DHCP)")

    _state["applied"] = desired
    _state["last_apply"] = now
