"""Web content filter — blocks adult/dangerous categories via family DNS, plus a
parent-defined keyword/domain block list enforced by a tiny local DNS filter.

Two layers:
  1. CATEGORY filter — point adapters at a family resolver (Cloudflare for
     Families 1.1.1.3/1.0.0.3) that blocks adult + malware/phishing.
  2. CUSTOM terms — when the parent enters words/domains (e.g. "lrytas"), we run
     a tiny local DNS forwarder on 127.0.0.1/::1 and point the adapters at it.
     It forwards normal lookups upstream (to the family resolver if the category
     filter is on, else a plain resolver) but returns NXDOMAIN for any hostname
     CONTAINING a blocked term — so "lrytas" kills lrytas.lt, *.lrytas.lt,
     lrytas.com, every subdomain/TLD. (Substring match on the hostname only; it
     can't see words inside HTTPS pages or search results.)

Tiering keeps risk low: the common case (category only) uses direct adapter DNS
with NO local server. The local resolver runs only when custom terms exist, and
if it can't bind we fall back so the PC never loses internet.

Windows-only; a no-op elsewhere so the agent still runs in dev.
"""
from __future__ import annotations

import socket
import socketserver
import subprocess
import sys
import threading
import time

RESOLVERS: dict[str, dict[str, list[str]]] = {
    "cloudflare": {"v4": ["1.1.1.3", "1.0.0.3"], "v6": ["2606:4700:4700::1113", "2606:4700:4700::1003"]},
    "cleanbrowsing": {"v4": ["185.228.168.168", "185.228.169.168"], "v6": []},
    "opendns": {"v4": ["208.67.222.123", "208.67.220.123"], "v6": []},
}
DEFAULT_RESOLVER = "cloudflare"
PLAIN_UPSTREAM = ["1.1.1.1", "1.0.0.1"]  # used when only custom terms (no category) are on

_REASSERT_SEC = 300

_state: dict[str, object] = {
    "enabled": False,           # category filter
    "resolver": DEFAULT_RESOLVER,
    "terms": [],                # list[str] custom keywords/domains (lowercased)
    "upstream": PLAIN_UPSTREAM, # where the local proxy forwards non-blocked queries
    "applied": None,
    "last_apply": 0.0,
}

# Local DNS proxy servers (v4 + v6 loopback).
_servers: list[socketserver.BaseServer] = []


# ---------------------------------------------------------------- public API
def set_web_filter(enabled: bool, resolver: str | None = None) -> None:
    _state["enabled"] = bool(enabled)
    if resolver and resolver in RESOLVERS:
        _state["resolver"] = resolver


def set_terms(terms: list[str] | None) -> None:
    _state["terms"] = sorted({t.strip().lower() for t in (terms or []) if t and t.strip()})


# ---------------------------------------------------------------- DNS packet
def _qname(data: bytes) -> str:
    i, labels = 12, []
    while data[i] != 0:
        ln = data[i]
        labels.append(data[i + 1 : i + 1 + ln].decode("ascii", "ignore"))
        i += 1 + ln
    return ".".join(labels).lower()


def _question(data: bytes) -> bytes:
    i = 12
    while data[i] != 0:
        i += 1 + data[i]
    return data[12 : i + 1 + 4]  # name + null + qtype + qclass


def _reply(data: bytes, rcode: int) -> bytes | None:
    try:
        flags = (0x8180 | rcode).to_bytes(2, "big")  # QR=1, RD=1, RA=1, + rcode
        return data[0:2] + flags + b"\x00\x01" + b"\x00\x00\x00\x00\x00\x00" + _question(data)
    except Exception:
        return None


def _blocked(name: str) -> bool:
    return any(t in name for t in _state["terms"])  # type: ignore[operator]


class _Handler(socketserver.BaseRequestHandler):
    def handle(self) -> None:
        data, sock = self.request
        try:
            name = _qname(data)
        except Exception:
            name = ""
        if name and _blocked(name):
            r = _reply(data, 3)  # NXDOMAIN
            if r:
                sock.sendto(r, self.client_address)
            return
        for up in (_state["upstream"] or PLAIN_UPSTREAM):  # type: ignore[union-attr]
            try:
                u = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                u.settimeout(3.0)
                u.sendto(data, (up, 53))
                resp, _ = u.recvfrom(4096)
                u.close()
                sock.sendto(resp, self.client_address)
                return
            except Exception:
                continue
        sf = _reply(data, 2)  # SERVFAIL
        if sf:
            sock.sendto(sf, self.client_address)


class _UDP6(socketserver.ThreadingUDPServer):
    address_family = socket.AF_INET6


def _proxy_running() -> bool:
    return len(_servers) > 0


def _start_proxy() -> bool:
    if _proxy_running():
        return True
    socketserver.ThreadingUDPServer.allow_reuse_address = True
    ok = False
    for fam, host, cls in ((4, "127.0.0.1", socketserver.ThreadingUDPServer), (6, "::1", _UDP6)):
        try:
            srv = cls((host, 53), _Handler)
            threading.Thread(target=srv.serve_forever, name=f"git1-dns{fam}", daemon=True).start()
            _servers.append(srv)
            ok = True
        except Exception as e:  # noqa: BLE001
            print(f"[dns] local proxy v{fam} bind failed: {e}")
    return ok


def _stop_proxy() -> None:
    for srv in _servers:
        try:
            srv.shutdown()
            srv.server_close()
        except Exception:
            pass
    _servers.clear()


# ---------------------------------------------------------------- adapters
def _run(args: list[str]) -> bool:
    try:
        return subprocess.run(args, capture_output=True, text=True, timeout=20).returncode == 0
    except Exception as e:  # noqa: BLE001
        print(f"[dns] cmd failed {args[:3]}...: {e}")
        return False


def _adapters() -> list[str]:
    names: list[str] = []
    try:
        out = subprocess.run(["netsh", "interface", "show", "interface"],
                             capture_output=True, text=True, timeout=15).stdout
        for line in out.splitlines():
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
        _run(["netsh", "interface", "ipv4", "set", "dns", f"name={adapter}", "static", v4[0], "primary", "no"])
        for i, ip in enumerate(v4[1:], start=2):
            _run(["netsh", "interface", "ipv4", "add", "dns", f"name={adapter}", ip, f"index={i}"])
    if v6:
        _run(["netsh", "interface", "ipv6", "set", "dns", f"name={adapter}", "static", v6[0], "primary", "no"])
        for i, ip in enumerate(v6[1:], start=2):
            _run(["netsh", "interface", "ipv6", "add", "dns", f"name={adapter}", ip, f"index={i}"])


def _revert(adapter: str) -> None:
    _run(["netsh", "interface", "ipv4", "set", "dns", f"name={adapter}", "dhcp"])
    _run(["netsh", "interface", "ipv6", "set", "dns", f"name={adapter}", "dhcp"])


def _set_doh(disable: bool) -> None:
    for k in (r"HKLM\SOFTWARE\Policies\Google\Chrome", r"HKLM\SOFTWARE\Policies\Microsoft\Edge"):
        if disable:
            _run(["reg", "add", k, "/v", "DnsOverHttpsMode", "/t", "REG_SZ", "/d", "off", "/f"])
        else:
            _run(["reg", "delete", k, "/v", "DnsOverHttpsMode", "/f"])


# ---------------------------------------------------------------- enforce
def enforce() -> None:
    """Apply desired state. Cheap no-op when steady + recently re-asserted."""
    if sys.platform != "win32":
        return
    enabled = bool(_state["enabled"])
    terms = list(_state["terms"])  # type: ignore[arg-type]
    resolver = str(_state["resolver"])
    family = RESOLVERS.get(resolver, RESOLVERS[DEFAULT_RESOLVER])

    desired = (enabled, resolver, tuple(terms))
    now = time.time()
    fresh = (now - float(_state["last_apply"])) < _REASSERT_SEC
    # If terms are active the proxy must stay alive; re-check liveness each call.
    if desired == _state["applied"] and fresh and (not terms or _proxy_running()):
        return

    if terms:
        # Custom keyword/domain filtering -> run the local resolver.
        _state["upstream"] = family["v4"] if enabled else PLAIN_UPSTREAM
        if _start_proxy():
            for ad in _adapters():
                _set_dns(ad, ["127.0.0.1"], ["::1"])
            _set_doh(True)
            print(f"[dns] filter ON (custom terms={len(terms)}, category={'on' if enabled else 'off'})")
        else:
            # Fail-safe: couldn't bind the proxy. Don't strand the PC on a dead
            # 127.0.0.1 — fall back to direct DNS so the internet still works.
            _stop_proxy()
            if enabled:
                for ad in _adapters():
                    _set_dns(ad, family["v4"], family["v6"])
                _set_doh(True)
                print("[dns] proxy unavailable; category-only direct DNS")
            else:
                for ad in _adapters():
                    _revert(ad)
                _set_doh(False)
                print("[dns] proxy unavailable; reverted to DHCP")
    elif enabled:
        # Category only -> direct adapter DNS, no local server.
        _stop_proxy()
        for ad in _adapters():
            _set_dns(ad, family["v4"], family["v6"])
        _set_doh(True)
        print(f"[dns] category filter ON ({resolver})")
    else:
        # Everything off -> revert once.
        _stop_proxy()
        prev = _state["applied"]
        if prev is not None and (prev[0] or prev[2]):  # was previously active
            for ad in _adapters():
                _revert(ad)
            _set_doh(False)
            print("[dns] filter OFF (reverted to DHCP)")

    _state["applied"] = desired
    _state["last_apply"] = now
