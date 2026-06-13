@echo off
REM ============================================================
REM  Wipe agent state, pull latest code, start fresh, print pair code.
REM ============================================================
net session >nul 2>&1
if %errorlevel% NEQ 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

set "SYSCFG=C:\Windows\System32\config\systemprofile\AppData\Roaming\Git1"
set "USRCFG=%APPDATA%\Git1"
set "INSTALL=C:\ProgramData\Git1"
set "SERVER=https://git1-server.onrender.com"

echo === [1/5] Stopping service ===
net stop Git1Agent >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo === [2/5] Wiping stale agent state ===
for %%F in (agent.json config.json policy.json offline-queue.json last-pair.txt recovery.txt) do (
  if exist "%SYSCFG%\%%F" del /f /q "%SYSCFG%\%%F" >nul 2>&1
  if exist "%USRCFG%\%%F" del /f /q "%USRCFG%\%%F" >nul 2>&1
)
echo   token, policy, queue, and recovery files cleared

echo === [3/5] Pulling latest agent code ===
git -C "%INSTALL%" fetch origin claude/setup-git1-dev-environment-QeNdU >nul 2>&1
git -C "%INSTALL%" reset --hard origin/claude/setup-git1-dev-environment-QeNdU >nul 2>&1
echo   latest code on disk

echo === [4/5] Fetching pair code DIRECTLY from server ===
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;" ^
  "$r = Invoke-RestMethod -UseBasicParsing -Method Post -Uri '%SERVER%/agent/pair/start' -TimeoutSec 30;" ^
  "$code = $r.code;" ^
  "Write-Host '';" ^
  "Write-Host ('   PAIRING CODE: ' + $code) -ForegroundColor Green -BackgroundColor Black;" ^
  "Write-Host '   -> Open https://git1-server.onrender.com on your phone' -ForegroundColor Cyan;" ^
  "Write-Host '   -> Enter this 6-digit code in the dashboard and press Pair' -ForegroundColor Cyan;" ^
  "Write-Host '';" ^
  "Write-Host '   Waiting up to 5 minutes for you to enter it...';" ^
  "$tok = $null; $devId = $null;" ^
  "for ($i=0; $i -lt 150 -and -not $tok; $i++) {" ^
  "  Start-Sleep -Seconds 2;" ^
  "  try { $p = Invoke-RestMethod -UseBasicParsing -Method Get -Uri ('%SERVER%/agent/pair/poll?code='+$code) -TimeoutSec 10; if ($p.status -eq 'paired') { $tok = $p.agentToken; $devId = $p.deviceId; Write-Host '   PAIRED!' -ForegroundColor Green; break } } catch {}" ^
  "}" ^
  "if (-not $tok) { Write-Host '   Timed out waiting for pair. Re-run when ready.' -ForegroundColor Yellow; exit 1 }" ^
  "$dir = '%SYSCFG%'; New-Item -ItemType Directory -Force -Path $dir | Out-Null;" ^
  "$cfg = @{ agentToken=$tok; deviceId=$devId; server='%SERVER%' } | ConvertTo-Json -Compress;" ^
  "Set-Content -LiteralPath (Join-Path $dir 'agent.json') -Value $cfg -Encoding UTF8 -NoNewline;" ^
  "Write-Host ('   wrote token to ' + (Join-Path $dir 'agent.json'))"

if errorlevel 1 (
  echo Pair did not complete. Re-run this script when you're ready to pair.
  pause
  exit /b 1
)

echo === [5/5] Starting service ===
net start Git1Agent
timeout /t 5 /nobreak >nul

echo.
echo === Last 15 log lines ===
powershell -NoProfile -Command "Get-Content 'C:\ProgramData\Git1\agent\agent.log' -Tail 15"
echo.
echo Done. Device should be ONLINE in the dashboard now.
pause
