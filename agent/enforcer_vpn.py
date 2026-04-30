"""VPN / Tor / proxy detection.

Strategies:
  1. Snapshot the network adapter list at startup. Any new adapter whose
     name suggests a tunnel (tun*, tap*, wg*, openvpn, nord, proton, ...)
     is reported as `vpn_detected`.
  2. Maintain a hard-coded list of common VPN/Tor client executables.
     The agent's app blocklist already kills these if the parent enables;
     this module exposes the list so the UI can show it.
  3. Block well-known Tor ports at the firewall.
"""
from __future__ import annotations

import re
import subprocess
import sys

import psutil

# Common executable names for VPN clients and Tor. Lowercase.
VPN_CLIENT_EXES: list[str] = [
    "openvpn.exe",
    "openvpn-gui.exe",
    "wireguard.exe",
    "nordvpn.exe",
    "nordvpn-service.exe",
    "protonvpn.exe",
    "protonvpn-service.exe",
    "expressvpn.exe",
    "expressvpnd.exe",
    "mullvad.exe",
    "mullvad-daemon.exe",
    "surfshark.exe",
    "cyberghost.exe",
    "tunnelbear.exe",
    "hide.me.exe",
    "windscribe.exe",
    "tor.exe",
    "torbrowser.exe",
    "firefox.exe.tor",  # Tor Browser sometimes
]

# Adapter-name fragments that indicate tunnels.
ADAPTER_HINTS = re.compile(
    r"(tun|tap|wg|openvpn|nord|proton|wireguard|expressvpn|mullvad|tor)",
    re.IGNORECASE,
)

_baseline: set[str] = set()


def snapshot_adapters() -> set[str]:
    return set(psutil.net_if_addrs().keys())


def init_baseline() -> None:
    global _baseline
    _baseline = snapshot_adapters()


def detect_new_tunnels() -> list[str]:
    """Return adapter names that appeared since baseline and look tunnel-y."""
    current = snapshot_adapters()
    new = current - _baseline
    suspicious = [n for n in new if ADAPTER_HINTS.search(n)]
    if new:
        # Update baseline to avoid repeated detection of the same adapter.
        _baseline.update(new)
    return suspicious


def _run(args: list[str]) -> int:
    if sys.platform != "win32":
        return 0
    try:
        return subprocess.run(args, capture_output=True, timeout=10).returncode
    except Exception:
        return 1


TOR_RULE_NAME = "Git1BlockTor"


def block_tor_ports() -> bool:
    """Add an outbound firewall rule blocking Tor relay/SOCKS ports."""
    # Idempotent: delete any existing rule first.
    _run(["netsh", "advfirewall", "firewall", "delete", "rule", f"name={TOR_RULE_NAME}"])
    code = _run(
        [
            "netsh",
            "advfirewall",
            "firewall",
            "add",
            "rule",
            f"name={TOR_RULE_NAME}",
            "dir=out",
            "action=block",
            "protocol=TCP",
            "remoteport=9001,9030,9050,9051,9150",
            "enable=yes",
        ]
    )
    return code == 0


def unblock_tor_ports() -> bool:
    return _run(["netsh", "advfirewall", "firewall", "delete", "rule", f"name={TOR_RULE_NAME}"]) == 0
