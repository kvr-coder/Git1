"""Who is logged in at the physical console — used so enforcement (locking)
only ever affects the CHILD's session, never the parent/admin recovering.

Returns:
  ""   -> no interactive user (lock is harmless: it's the login screen)
  name -> the active console user's bare username (lowercased)
  None -> couldn't determine (query error) -> callers should FAIL SAFE and
          NOT lock, so a parent/admin is never trapped.
"""
from __future__ import annotations

import sys


def active_console_user() -> str | None:
    if sys.platform != "win32":
        return ""
    try:
        import win32ts  # type: ignore

        sess = win32ts.WTSGetActiveConsoleSessionId()
        if sess == 0xFFFFFFFF:
            return ""  # no one at the console
        user = win32ts.WTSQuerySessionInformation(
            win32ts.WTS_CURRENT_SERVER_HANDLE, sess, win32ts.WTSUserName
        )
        return (user or "").strip().lower()
    except Exception:  # noqa: BLE001
        return None  # unknown -> caller fails safe
