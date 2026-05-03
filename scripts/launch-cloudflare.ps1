# Git1 — one-click launcher (server + Cloudflare tunnel + agent + Expo)
#
# 1. Starts the Node backend
# 2. Starts a Cloudflare quick tunnel and waits up to 60s for the public URL
# 3. Sets that URL as GIT1_SERVER and launches the Python agent
# 4. Starts Expo Metro (LAN)
# 5. Copies the tunnel URL to clipboard so you can paste it into the app's
#    Settings → Server URL
#
# Run via the launch-cloudflare.bat shortcut on the desktop.

$ErrorActionPreference = "Stop"
$repo = $PSScriptRoot | Split-Path -Parent
Write-Host "=== Git1 launcher ===" -ForegroundColor Cyan
Write-Host "Repo: $repo"

# 0. Clean up stale node processes (port 8080 etc.)
Write-Host "[0/4] Killing stale node processes..."
taskkill /F /IM node.exe 2>$null | Out-Null
Start-Sleep -Milliseconds 500

# 1. Server
Write-Host "[1/4] Starting backend server on :8080"
if (-not (Test-Path "$repo\server\node_modules")) {
    Write-Host "    First run: npm install (server)"
    Push-Location "$repo\server"
    npm install
    Pop-Location
}
Start-Process cmd -ArgumentList "/k", "title Git1 Server && cd /d ""$repo\server"" && npm run dev"
Start-Sleep -Seconds 4

# 2. Cloudflare tunnel
Write-Host "[2/4] Starting Cloudflare quick tunnel..."
$logFile = Join-Path $env:TEMP "git1-tunnel.log"
Remove-Item $logFile -ErrorAction SilentlyContinue
Start-Process cmd -ArgumentList "/k", "title Git1 Tunnel && cloudflared tunnel --url http://localhost:8080 --logfile ""$logFile"""

Write-Host "    Waiting for public URL (up to 60s)..."
$url = $null
$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline -and -not $url) {
    Start-Sleep -Seconds 2
    if (Test-Path $logFile) {
        $m = Select-String -Path $logFile -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -List -ErrorAction SilentlyContinue
        if ($m) { $url = $m.Matches[0].Value }
    }
}

# 3. Agent (with tunnel URL if we got one)
if ($url) {
    Write-Host "    URL: $url" -ForegroundColor Green
    try { Set-Clipboard -Value $url; Write-Host "    Copied to clipboard." } catch {}
    Write-Host "[3/4] Starting agent (GIT1_SERVER=$url)"
    if (-not (Test-Path "$repo\agent\.deps_installed")) {
        Push-Location "$repo\agent"
        pip install -r requirements.txt
        "ok" | Out-File "$repo\agent\.deps_installed"
        Pop-Location
    }
    Start-Process cmd -ArgumentList "/k", "title Git1 Agent && set GIT1_SERVER=$url && cd /d ""$repo\agent"" && python agent.py"
} else {
    Write-Host "    Timed out waiting for tunnel — starting agent in LAN mode" -ForegroundColor Yellow
    Start-Process cmd -ArgumentList "/k", "title Git1 Agent && cd /d ""$repo\agent"" && python agent.py"
}

# 4. Expo (Metro bundler)
Write-Host "[4/4] Starting Expo (LAN)"
if (-not (Test-Path "$repo\node_modules")) {
    Write-Host "    First run: npm install (mobile)"
    Push-Location $repo
    npm install --legacy-peer-deps
    Pop-Location
}
Start-Process cmd -ArgumentList "/k", "title Git1 Expo && cd /d ""$repo"" && powershell -ExecutionPolicy Bypass -File scripts\dev-watch.ps1"

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
Write-Host ""
if ($url) {
    Write-Host "Public server URL (also in clipboard):" -ForegroundColor Green
    Write-Host "  $url"
    Write-Host ""
    Write-Host "On your phone: open the app -> Settings -> Server URL -> paste -> Save."
} else {
    Write-Host "Tunnel didn't come up. Open the Git1 Tunnel window to see why." -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Four windows are now open: Server, Tunnel, Agent, Expo."
Write-Host "Close any of them to stop that component."
Read-Host "Press Enter to close this launcher window"
