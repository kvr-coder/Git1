@echo off
setlocal enabledelayedexpansion

REM Self-elevate to Administrator (firewall rules need admin).
net session >nul 2>&1
if %errorlevel% NEQ 0 (
  echo Requesting admin rights for firewall rules...
  powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

REM ===== EDIT THESE =====
set REPO_DIR=C:\Users\Kvara\Git1
set GIT1_SERVER=https://git1-server.onrender.com
set GIT1_EMAIL=kvara@test.com
set GIT1_PASSWORD=hunter22
REM ======================

if not exist "%REPO_DIR%" ( echo Edit REPO_DIR. & pause & exit /b 1 )

echo === Git1 launcher ^(admin^) ===
echo Server: %GIT1_SERVER%
echo Account: %GIT1_EMAIL%
echo.

echo [0] Killing stale node processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 /nobreak >nul

echo [1] Pinging Render server (cold start can take ~30s)...
set /a tries=0
:wait_render
timeout /t 3 /nobreak >nul
set /a tries+=1
curl.exe -s -o nul -m 10 %GIT1_SERVER%/health
if errorlevel 1 (
  if %tries% gtr 20 ( echo Server unreachable. & pause & exit /b 1 )
  echo     Still waking up... ^(try %tries%/20^)
  goto wait_render
)
echo     Server OK.

echo [2] Auto-registering account (ignore 'email taken')...
powershell -NoProfile -Command "try { Invoke-RestMethod -Uri '%GIT1_SERVER%/auth/register' -Method Post -ContentType 'application/json' -Body '{\"email\":\"%GIT1_EMAIL%\",\"password\":\"%GIT1_PASSWORD%\"}' | Out-Null; Write-Host '    registered.' } catch { Write-Host '    already exists, ok.' }"

echo [3] Logging in to grab token...
for /f "usebackq delims=" %%t in (`powershell -NoProfile -Command "(Invoke-RestMethod -Uri '%GIT1_SERVER%/auth/login' -Method Post -ContentType 'application/json' -Body '{\"email\":\"%GIT1_EMAIL%\",\"password\":\"%GIT1_PASSWORD%\"}').token"`) do set "TOKEN=%%t"
if "%TOKEN%"=="" ( echo Login failed. & pause & exit /b 1 )
echo     Token: %TOKEN:~0,12%...

echo [4] Starting Cloudflare tunnel for Metro...
set TUNLOG=%TEMP%\git1-metro-tunnel.log
del "%TUNLOG%" >nul 2>&1
start "Git1 Metro Tunnel" cmd /k "cloudflared tunnel --url http://localhost:8081 --logfile %TUNLOG%"

set METRO_URL=
set /a tries=0
:wait_metro
timeout /t 2 /nobreak >nul
set /a tries+=1
if %tries% gtr 30 goto skip_metro
if not exist "%TUNLOG%" goto wait_metro
for /f "usebackq delims=" %%u in (`powershell -NoProfile -Command "$m = (Select-String -Path '%TUNLOG%' -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -List).Matches; if ($m) { $m[0].Value.Trim() }"`) do set "METRO_URL=%%u"
if "%METRO_URL%"=="" goto wait_metro
echo     Metro: %METRO_URL%
:skip_metro

echo [5] Starting agent and waiting for pairing code...
del "%APPDATA%\Git1\last-pair.txt" >nul 2>&1
del "%APPDATA%\Git1\agent.json" >nul 2>&1
if not exist "%REPO_DIR%\agent\.deps_installed" (
  pushd "%REPO_DIR%\agent" & call pip install -r requirements.txt & echo ok > .deps_installed & popd
)
start "Git1 Agent" cmd /k "set GIT1_SERVER=%GIT1_SERVER%&&cd /d %REPO_DIR%\agent && python agent.py"

set CODE=
set /a tries=0
:wait_code
timeout /t 2 /nobreak >nul
set /a tries+=1
if %tries% gtr 30 ( echo Agent didn't print code. & goto launch_expo )
if not exist "%APPDATA%\Git1\last-pair.txt" goto wait_code
for /f "usebackq delims=" %%c in ("%APPDATA%\Git1\last-pair.txt") do set "CODE=%%c"
if "%CODE%"=="" goto wait_code
echo     Pair code: %CODE%

echo [6] Auto-pairing device with token...
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Invoke-RestMethod -Uri '%GIT1_SERVER%/devices/pair' -Method Post -ContentType 'application/json' -Headers @{Authorization='Bearer %TOKEN%'} -Body '{\"code\":\"%CODE%\",\"name\":\"%COMPUTERNAME%\"}').id"`) do set "DEVICE_ID=%%i"
if "%DEVICE_ID%"=="" (
  echo     Pairing failed.
  goto launch_expo
)
echo     Device ID: %DEVICE_ID%

echo [7] Seeding default schedules + templates from scripts\seed.json...
powershell -NoProfile -Command ^
  "$seed = Get-Content '%REPO_DIR%\scripts\seed.json' | ConvertFrom-Json;" ^
  "$auth = @{Authorization='Bearer %TOKEN%'};" ^
  "foreach ($t in $seed.templates) {" ^
  "  $body = @{ description=$t.description; minutes=$t.minutes } | ConvertTo-Json;" ^
  "  try { Invoke-RestMethod -Uri ('%GIT1_SERVER%/devices/%DEVICE_ID%/chore-templates') -Method Post -ContentType 'application/json' -Headers $auth -Body $body | Out-Null; Write-Host ('    +template: ' + $t.description) } catch { Write-Host ('    template fail: ' + $t.description) }" ^
  "};" ^
  "foreach ($s in $seed.schedules) {" ^
  "  $id = 's' + [DateTimeOffset]::Now.ToUnixTimeMilliseconds() + (Get-Random -Maximum 999);" ^
  "  $body = @{ id=$id; deviceId='%DEVICE_ID%'; name=$s.name; days=$s.days; startMinute=$s.startMinute; endMinute=$s.endMinute; enabled=$s.enabled; actions=$s.actions } | ConvertTo-Json;" ^
  "  try { Invoke-RestMethod -Uri ('%GIT1_SERVER%/schedules/' + $id) -Method Put -ContentType 'application/json' -Headers $auth -Body $body | Out-Null; Write-Host ('    +schedule: ' + $s.name) } catch { Write-Host ('    schedule fail: ' + $s.name) }" ^
  "};" ^
  "$bs = $seed.borrowSettings;" ^
  "$body = @{ kind='set_borrow_settings'; payload=@{enabled=$bs.enabled; capMinutes=$bs.capMinutes} } | ConvertTo-Json -Depth 5;" ^
  "try { Invoke-RestMethod -Uri ('%GIT1_SERVER%/devices/%DEVICE_ID%/command') -Method Post -ContentType 'application/json' -Headers $auth -Body $body | Out-Null; Write-Host '    +borrow settings applied' } catch { Write-Host '    borrow settings fail' }"

:launch_expo
echo [8] Starting Expo (Metro via Cloudflare)...
if not exist "%REPO_DIR%\node_modules" (
  pushd "%REPO_DIR%" & call npm install --legacy-peer-deps & popd
)
set "METRO_HOST=%METRO_URL:https://=%"
start "Git1 Expo" cmd /k "cd /d %REPO_DIR%&&set EXPO_PACKAGER_PROXY_URL=%METRO_URL%&&set REACT_NATIVE_PACKAGER_HOSTNAME=%METRO_HOST%&&npx expo start --port 8081 --clear"

echo|set /p="%GIT1_SERVER%" | clip

echo.
echo === Done ===
echo Account:    %GIT1_EMAIL% / %GIT1_PASSWORD%
echo Server URL: %GIT1_SERVER%   ^(in clipboard^)
echo Device ID:  %DEVICE_ID%
echo Metro URL:  %METRO_URL%
echo.
echo On phone: scan QR -^> Sign in (creds prefilled).
echo Lock/Internet now actually work because agent is admin.
pause
endlocal
