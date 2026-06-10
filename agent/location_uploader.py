"""Best-effort location reporting for the Git1 Windows agent.

Honest caveats:
  - A desktop PC rarely moves, so "geofencing" on Windows is mostly a
    home/away signal. Real geofencing belongs on a mobile kid device.
  - We use IP-based geolocation (ipapi.co) as the fallback source. Accuracy
    is city-level (1-30 km), not metres. Set a generous geofence radius on
    the parent side accordingly.
  - On Windows 10/11 we *could* use winrt Windows.Devices.Geolocation for
    Wi-Fi-based positioning, which is much more accurate. That requires the
    `winsdk` package and the user granting the "Location" Windows privacy
    permission. Wired up below as a no-op fallback hook for future work.

Sends batches every UPLOAD_INTERVAL_SEC, queueing offline writes via the same
file the offline_queue uses isn't necessary — for locations we just drop on
failure (next tick will refetch).
"""
from __future__ import annotations

import threading
import time
from typing import Callable

import requests

UPLOAD_INTERVAL_SEC = 15 * 60  # 15 min — desktop doesn't move much


def _ip_geolocate() -> tuple[float, float, float] | None:
    """Returns (lat, lng, accuracyMeters) or None on failure."""
    try:
        r = requests.get("https://ipapi.co/json/", timeout=8)
        if r.status_code != 200:
            return None
        j = r.json()
        lat = float(j.get("latitude"))
        lng = float(j.get("longitude"))
        return (lat, lng, 5000.0)  # honest: ~5km
    except Exception:
        return None


def _winrt_geolocate() -> tuple[float, float, float] | None:
    """Try Windows Wi-Fi/GPS positioning. No-op unless winsdk is installed."""
    try:
        import asyncio
        from winsdk.windows.devices.geolocation import Geolocator  # type: ignore
    except Exception:
        return None
    try:
        loop = asyncio.new_event_loop()
        try:
            pos = loop.run_until_complete(Geolocator().get_geoposition_async())
        finally:
            loop.close()
        c = pos.coordinate
        return (float(c.point.position.latitude),
                float(c.point.position.longitude),
                float(c.accuracy or 100.0))
    except Exception:
        return None


def fetch_location() -> tuple[float, float, float] | None:
    return _winrt_geolocate() or _ip_geolocate()


def start(server_http: str, get_token: Callable[[], str | None]) -> threading.Thread:
    def run() -> None:
        while True:
            try:
                token = get_token()
                if not token:
                    time.sleep(30); continue
                loc = fetch_location()
                if loc is None:
                    time.sleep(60); continue
                lat, lng, acc = loc
                requests.post(
                    f"{server_http}/agent/locations",
                    headers={"Authorization": f"Bearer {token}"},
                    json={"points": [{
                        "lat": lat, "lng": lng,
                        "accuracyMeters": acc,
                        "recordedAt": int(time.time() * 1000),
                    }]},
                    timeout=10,
                )
                print(f"[loc] uploaded {lat:.3f},{lng:.3f} ±{int(acc)}m")
            except Exception as e:
                print(f"[loc] tick failed: {e}")
            time.sleep(UPLOAD_INTERVAL_SEC)

    t = threading.Thread(target=run, name="git1-location", daemon=True)
    t.start()
    return t
