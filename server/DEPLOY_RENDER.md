# Deploy the Git1 server to Render.com

5 minutes, free, gives you a permanent HTTPS URL like
`https://git1-server-xxxx.onrender.com`. The PC at home no longer needs
to be running for the phone app or the kid's PC agent to work.

## One-time setup

1. **Sign up** at https://render.com (Google / GitHub login works).
2. Make sure your GitHub repo (`kvr-coder/Git1`) is **public**, OR install
   the Render GitHub App on your account so it can access private repos.
3. In the Render dashboard click **New → Blueprint**.
4. Paste your repo URL, e.g. `https://github.com/kvr-coder/Git1`.
5. Pick the branch (`claude/test-hub-web-launch-tAo7u` or whatever you've
   merged into `main`).
6. Render reads `render.yaml`, shows "git1-server (Web Service)" — click
   **Apply**.
7. Wait ~3-5 min for the first build. Watch the build log; on success the
   page shows a green "Live" badge and your URL.

## Verify it's live

```
curl https://git1-server-xxxx.onrender.com/devices
```
Should return `{"error":"unauthorized"}`.

## Use it

- **Mobile app**: Settings → Server URL → paste `https://git1-server-xxxx.onrender.com` → Save. **You set this once and never again** (unlike the rotating Cloudflare quick-tunnel URLs).
- **Agent**: set `GIT1_SERVER` to the Render URL before launching:
  ```
  $env:GIT1_SERVER = "https://git1-server-xxxx.onrender.com"
  python agent.py
  ```
  Or update your `Git1.bat` to use this URL instead of starting a Cloudflare tunnel.

## Caveats

- **Free tier sleeps after ~15 min of inactivity** and takes ~30 s to wake
  up on the next request. The phone app handles this gracefully (the first
  request just looks slow).
- **Free tier disk is ephemeral**: every redeploy or restart wipes the
  SQLite DB. For real use, attach a persistent disk in Render's dashboard
  (Settings → Disks → Add Disk, mount at `/var/data`, and set
  `GIT1_DB=/var/data/git1.db` in env vars). Costs $7/mo.
- **Auto-redeploys on every push to the configured branch** — convenient
  but be aware your test pushes will replace the running version.

## Updating the deployment

Just `git push`. Render watches the branch and rebuilds automatically.
Watch the deploy log on the service's dashboard page.
