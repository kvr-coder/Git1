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
  SQLite DB. Two ways to fix without paying for a disk:
  1. **Litestream → Cloudflare R2 (free, recommended)** — see below.
  2. Attach a $7/mo Render disk (Settings → Disks, mount `/var/data`, set
     `GIT1_DB=/var/data/git1.db`).
- **Auto-redeploys on every push to the configured branch** — convenient
  but be aware your test pushes will replace the running version.

## Free durable storage: Litestream + Cloudflare R2 (5 min)

This streams the SQLite DB to object storage and restores it on boot, so the
data **survives every redeploy/restart** — no paid disk needed. Already wired
into `start.sh` + `render.yaml`; you only supply credentials.

1. **Create an R2 bucket** (Cloudflare dashboard → R2 → Create bucket), e.g.
   `git1`. R2's free tier is 10 GB — far more than enough.
2. **Make an R2 API token** (R2 → Manage API Tokens → Create, "Object Read &
   Write"). Note the **Access Key ID**, **Secret Access Key**, and your
   account's S3 endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
3. **Set these env vars** in the Render service (Environment tab), marking the
   secrets as secret:
   - `LITESTREAM_REPLICA_URL` = `s3://git1/db` (bucket + path)
   - `LITESTREAM_ACCESS_KEY_ID` = R2 access key id
   - `LITESTREAM_SECRET_ACCESS_KEY` = R2 secret
   - `LITESTREAM_ENDPOINT` = `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
4. **Redeploy.** Build log should show `[litestream] installed`; start log
   `Litestream enabled`. On the *next* deploy it will `restore` the DB and your
   accounts/devices persist. Leaving the vars blank = old ephemeral behaviour.

> Backblaze B2 or any S3-compatible store works too — same vars, just point
> `LITESTREAM_ENDPOINT`/`LITESTREAM_REPLICA_URL` at that provider.

## Keep it warm (avoid 30 s cold starts)

The free tier sleeps after ~15 min idle. For a summer demo, set up a free
uptime pinger to hit `/health` every ~10 min so it's always warm:
- [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com)
  → new monitor → URL `https://git1-server.onrender.com/health`, interval 10 min.

## Updating the deployment

Just `git push`. Render watches the branch and rebuilds automatically.
Watch the deploy log on the service's dashboard page.
