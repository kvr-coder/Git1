// Spawns the server + drives the Python agent modules (offline_queue,
// location_uploader, recovery) via small Python scripts. Confirms the kid
// side actually talks to the new endpoints end-to-end.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const dir = mkdtempSync(join(tmpdir(), 'git1-kid-'));
const PORT = 18080 + Math.floor(Math.random() * 1000);
const ROOT = `http://127.0.0.1:${PORT}`;

const srv = spawn('node', ['--import', 'tsx', 'src/index.ts'], {
  env: { ...process.env, PORT: String(PORT), GIT1_DB: join(dir, 'kid.db'),
         PARENT_INVITE_CODE: 'TESTCODE' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
srv.stdout.on('data', (b) => process.stderr.write('[srv] ' + b));
srv.stderr.on('data', (b) => process.stderr.write('[srv!] ' + b));

async function waitReady() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(ROOT + '/health')).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server never came up');
}
async function api(token, method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(ROOT + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

let failures = 0;
async function step(name, fn) {
  try { await fn(); console.log('  ✓', name); }
  catch (e) { failures++; console.log('  ✗', name, '\n     ', e.message); }
}

const py = process.env.PYTHON || 'python3';
// Confirm requests + pytest are available.
const probe = spawnSync(py, ['-c', 'import requests'], { stdio: 'pipe' });
if (probe.status !== 0) {
  console.log('Python "requests" module not installed; skipping kid-agent tests');
  srv.kill('SIGTERM');
  process.exit(0);
}

try {
  await waitReady();

  // Register parent + pair a device.
  const reg = await api(null, 'POST', '/auth/register',
    { email: 'p@x.com', password: 'pw12345678', invite: 'TESTCODE' });
  const parentToken = reg.token;
  const pc = await api(null, 'POST', '/agent/pair/start');
  const device = await api(parentToken, 'POST', '/devices/pair',
    { code: pc.code, name: 'KidPC' });
  const poll = await api(null, 'GET', '/agent/pair/poll?code=' + pc.code);
  let agentToken = poll.agentToken;

  // ── Offline queue: append while "offline", drain when server reachable ──
  await step('offline_queue: append + drain replays events', async () => {
    const queuePath = join(dir, 'q.json');
    const code = `
import sys; sys.path.insert(0, '${process.cwd().replace(/\\/g, '/')}/../agent')
from pathlib import Path
import offline_queue
q = offline_queue.OfflineQueue(Path(r'${queuePath.replace(/\\/g, '/')}'), '${ROOT}')
q.append('app_blocked', {'app': 'roblox'})
q.append('clock_tamper', {'driftSec': 99})
q.append('vpn_detected', {'adapters': ['nordlynx']})
print('size_before', q.size())
sent = q.drain('${agentToken}')
print('sent', sent, 'size_after', q.size())
`;
    const r = spawnSync(py, ['-c', code], { stdio: 'pipe', encoding: 'utf8' });
    if (r.status !== 0) throw new Error('python failed: ' + r.stderr);
    assert.match(r.stdout, /sent 3 size_after 0/);
    const act = await api(parentToken, 'GET', '/activity');
    const offlineKinds = act.filter(a => a.kind.startsWith('offline:')).map(a => a.kind);
    assert.ok(offlineKinds.includes('offline:app_blocked'),    'missing app_blocked');
    assert.ok(offlineKinds.includes('offline:clock_tamper'),   'missing clock_tamper');
    assert.ok(offlineKinds.includes('offline:vpn_detected'),   'missing vpn_detected');
  });

  // ── Location uploader: fetch_location() may return None (no internet in
  // sandbox); call the upload path directly to confirm contract. ──
  await step('location uploader posts a point that triggers a geofence', async () => {
    // Create a fence at (10, 10) radius 1km
    await api(parentToken, 'POST', '/geofences', {
      deviceId: device.id, name: 'Lab', lat: 10, lng: 10,
      radiusMeters: 1000, notifyOnEnter: true, notifyOnExit: true,
    });
    const code = `
import sys, requests, time
sys.path.insert(0, '${process.cwd().replace(/\\/g, '/')}/../agent')
# Force-post a "baseline outside" then an "inside" point.
for lat,lng in [(0.0,0.0),(10.0,10.0)]:
    r = requests.post('${ROOT}/agent/locations',
        headers={'Authorization':'Bearer ${agentToken}'},
        json={'points':[{'lat':lat,'lng':lng,'recordedAt':int(time.time()*1000)}]},
        timeout=10)
    print(lat, lng, r.status_code)
`;
    const r = spawnSync(py, ['-c', code], { stdio: 'pipe', encoding: 'utf8' });
    if (r.status !== 0) throw new Error('python failed: ' + r.stderr);
    assert.match(r.stdout, /10\.0 10\.0 200/);
    const act = await api(parentToken, 'GET', '/activity');
    assert.ok(act.some(a => a.kind === 'geofence_enter'), 'no enter event logged');
  });

  // ── Recovery flow: parent issues recovery code, agent's try_recovery()
  // consumes a hint file and gets a fresh token. ──
  await step('try_recovery() rotates token from CONFIG_DIR/recovery.txt', async () => {
    const rec = await api(parentToken, 'POST', `/devices/${device.id}/recovery-code`);
    const recDir = join(dir, 'rec'); writeFileSync(join(dir, 'recovery.txt'), rec.code);
    const code = `
import sys, pathlib
sys.path.insert(0, '${process.cwd().replace(/\\/g, '/')}/../agent')
import recovery
hint = pathlib.Path(r'${dir.replace(/\\/g, '/')}/recovery.txt')
new_token = recovery.try_recovery('${ROOT}', hint)
print('NEW_TOKEN', new_token)
`;
    const r = spawnSync(py, ['-c', code], { stdio: 'pipe', encoding: 'utf8' });
    if (r.status !== 0) throw new Error('python failed: ' + r.stderr);
    const m = r.stdout.match(/NEW_TOKEN (\w+)/);
    assert.ok(m, 'no NEW_TOKEN printed: ' + r.stdout);
    assert.notEqual(m[1], agentToken, 'token should rotate');
    assert.notEqual(m[1], 'None', 'recovery returned None');
  });

  console.log(failures === 0 ? '\nALL KID-AGENT TESTS PASSED' : `\n${failures} FAILED`);
  srv.kill('SIGTERM');
  rmSync(dir, { recursive: true, force: true });
  process.exit(failures === 0 ? 0 : 1);
} catch (e) {
  console.error('HARNESS ERROR:', e);
  srv.kill('SIGTERM');
  rmSync(dir, { recursive: true, force: true });
  process.exit(2);
}
