"""Kid-side dashboard.

A tiny HTTP server bound to 127.0.0.1 that the kid can open in a browser
to see their own status (time left, schedules, blocked apps, internet).
Includes a "request more minutes" button that triggers a callback the
agent uses to forward the request to the parent's mobile app.

Stdlib only (http.server) — no extra deps.
"""
from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable

DEFAULT_PORT = 8765

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Git1 — your dashboard</title>
<style>
  :root {
    --bg: #0f1115; --surface: #171a21; --alt: #1f2330;
    --border: #2a2f3d; --text: #f5f7fa; --muted: #9aa3b2;
    --primary: #4f8cff; --success: #3dd68c; --danger: #ff5c5c;
  }
  * { box-sizing: border-box; }
  body { background: var(--bg); color: var(--text);
    font: 15px/1.4 system-ui, -apple-system, Segoe UI, sans-serif;
    margin: 0; padding: 24px; max-width: 640px; margin: 0 auto; }
  h1 { margin: 0 0 4px; font-size: 28px; }
  .muted { color: var(--muted); font-size: 13px; }
  .card { background: var(--surface); border: 1px solid var(--border);
    border-radius: 16px; padding: 16px; margin: 16px 0; }
  .row { display: flex; align-items: center; gap: 12px; }
  .row > * + * { margin-left: 0; }
  .bar { background: var(--alt); height: 8px; border-radius: 999px;
    overflow: hidden; margin: 8px 0; }
  .fill { background: var(--primary); height: 100%; transition: width .3s; }
  .fill.over { background: var(--danger); }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 999px;
    font-size: 12px; font-weight: 600; background: var(--alt); color: var(--muted); }
  .badge.ok { background: #1e3a2a; color: var(--success); }
  .badge.bad { background: #3a1e1e; color: var(--danger); }
  button { background: var(--primary); color: white; border: 0;
    padding: 12px 18px; border-radius: 12px; font-size: 15px;
    font-weight: 600; cursor: pointer; }
  button:disabled { opacity: .5; cursor: not-allowed; }
  input, select { background: var(--alt); color: var(--text); border: 0;
    padding: 10px 12px; border-radius: 10px; font: inherit; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { background: var(--alt); border: 1px solid var(--border);
    padding: 6px 12px; border-radius: 999px; font-size: 13px; }
  #flash { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: var(--surface); border: 1px solid var(--border); padding: 10px 16px;
    border-radius: 12px; opacity: 0; transition: opacity .3s; }
  #flash.show { opacity: 1; }
</style>
</head>
<body>
<h1>Your dashboard</h1>
<p class="muted">This page only shows on your computer.</p>

<div class="card">
  <div class="row" style="justify-content: space-between;">
    <strong>Today</strong>
    <span class="badge" id="status-badge">…</span>
  </div>
  <div class="bar"><div class="fill" id="fill"></div></div>
  <div class="muted" id="usage-text">…</div>
</div>

<div class="card">
  <strong>Internet</strong>
  <div class="muted" id="net-text">…</div>
</div>

<div class="card">
  <strong>Schedules</strong>
  <div id="schedules" class="muted">…</div>
</div>

<div class="card">
  <strong>Blocked apps</strong>
  <div id="blocklist" class="chips" style="margin-top: 8px;"></div>
</div>

<div class="card">
  <strong>Ask for more time</strong>
  <p class="muted" style="margin: 8px 0;">Send a request to your parent.</p>
  <div class="row" style="gap: 8px;">
    <select id="minutes">
      <option value="5">5 min</option>
      <option value="15" selected>15 min</option>
      <option value="30">30 min</option>
      <option value="60">60 min</option>
    </select>
    <input id="reason" placeholder="Why? (optional)" style="flex: 1;" />
    <button id="request-btn">Request</button>
  </div>
</div>

<div id="flash"></div>

<script>
const fmt = (m) => m < 60 ? `${Math.round(m)}m` :
  `${Math.floor(m/60)}h ${Math.round(m%60)}m`;

async function refresh() {
  try {
    const r = await fetch('/status');
    const s = await r.json();
    const pct = Math.min(1, s.usedTodayMinutes / Math.max(1, s.limitMinutes));
    const fill = document.getElementById('fill');
    fill.style.width = `${pct * 100}%`;
    fill.classList.toggle('over', pct >= 1);
    document.getElementById('usage-text').textContent =
      `${fmt(s.usedTodayMinutes)} of ${fmt(s.limitMinutes)} used`;
    const b = document.getElementById('status-badge');
    if (!s.scheduleAllowed) { b.textContent = 'Outside schedule'; b.className = 'badge bad'; }
    else if (s.usedTodayMinutes >= s.limitMinutes) { b.textContent = 'Over limit'; b.className = 'badge bad'; }
    else { b.textContent = 'OK'; b.className = 'badge ok'; }
    document.getElementById('net-text').textContent =
      s.internetBlocked ? 'Blocked by parent' : 'Allowed';
    const sched = document.getElementById('schedules');
    if (!s.schedules || !s.schedules.length) sched.textContent = 'None.';
    else sched.innerHTML = s.schedules.map(x => {
      const days = (x.days || []).map(d => d.toUpperCase()).join(' ');
      const time = `${String(Math.floor(x.startMinute/60)).padStart(2,'0')}:${String(x.startMinute%60).padStart(2,'0')}`
        + `–${String(Math.floor(x.endMinute/60)).padStart(2,'0')}:${String(x.endMinute%60).padStart(2,'0')}`;
      return `<div>· ${x.name || 'Schedule'} — ${days} — ${time} ${x.enabled ? '' : '(off)'}</div>`;
    }).join('');
    const bl = document.getElementById('blocklist');
    bl.innerHTML = (s.blocklist && s.blocklist.length)
      ? s.blocklist.map(n => `<span class="chip">${n}</span>`).join('')
      : '<span class="muted">None.</span>';
  } catch (e) { /* offline */ }
}
refresh(); setInterval(refresh, 5000);

const flash = (msg) => {
  const el = document.getElementById('flash');
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
};

document.getElementById('request-btn').addEventListener('click', async (e) => {
  const btn = e.target; btn.disabled = true;
  const minutes = Number(document.getElementById('minutes').value);
  const reason = document.getElementById('reason').value;
  try {
    const r = await fetch('/request', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ minutes, reason }),
    });
    flash(r.ok ? 'Sent to your parent.' : 'Could not send.');
    if (r.ok) document.getElementById('reason').value = '';
  } catch { flash('Could not send.'); }
  finally { btn.disabled = false; }
});
</script>
</body>
</html>
"""


class Dashboard:
    def __init__(self, port: int = DEFAULT_PORT) -> None:
        self.port = port
        self.status: dict[str, Any] = {
            "usedTodayMinutes": 0,
            "limitMinutes": 120,
            "internetBlocked": False,
            "blocklist": [],
            "schedules": [],
            "scheduleAllowed": True,
        }
        self._on_request: Callable[[int, str], None] | None = None
        self._server: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None

    def update(self, **kwargs: Any) -> None:
        self.status.update(kwargs)

    def on_request(self, cb: Callable[[int, str], None]) -> None:
        self._on_request = cb

    def start(self) -> None:
        if self._server is not None:
            return
        dash = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_args: Any) -> None:  # silence stdout spam
                pass

            def _send_json(self, code: int, obj: Any) -> None:
                body = json.dumps(obj).encode()
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def do_GET(self) -> None:
                if self.path == "/" or self.path.startswith("/index"):
                    body = PAGE.encode()
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                elif self.path == "/status":
                    self._send_json(200, dash.status)
                else:
                    self._send_json(404, {"error": "not found"})

            def do_POST(self) -> None:
                if self.path != "/request":
                    return self._send_json(404, {"error": "not found"})
                length = int(self.headers.get("Content-Length") or 0)
                try:
                    payload = json.loads(self.rfile.read(length) or b"{}")
                except Exception:
                    payload = {}
                minutes = int(payload.get("minutes") or 0)
                reason = str(payload.get("reason") or "")
                if minutes <= 0 or minutes > 240:
                    return self._send_json(400, {"error": "invalid minutes"})
                cb = dash._on_request
                if cb:
                    try:
                        cb(minutes, reason)
                    except Exception as e:
                        return self._send_json(500, {"error": str(e)})
                self._send_json(200, {"ok": True})

        self._server = ThreadingHTTPServer(("127.0.0.1", self.port), Handler)
        self._thread = threading.Thread(
            target=self._server.serve_forever, name="git1-dashboard", daemon=True
        )
        self._thread.start()
        print(f"[dashboard] http://127.0.0.1:{self.port}")

    def stop(self) -> None:
        if self._server is not None:
            self._server.shutdown()
            self._server = None
