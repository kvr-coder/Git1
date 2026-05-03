@echo off
setlocal enabledelayedexpansion

REM Self-elevate to Administrator (firewall rules need admin).
net session >nul 2>&1
if %errorlevel% NEQ 0 (
  echo Requesting admin rights for firewall rules...
  powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

REM ===== EDIT THESE IF NEEDED =====
set REPO_DIR=C:\Users\Kvara\Git1
set GIT1_SERVER=https://git1-server.onrender.com
set GIT1_EMAIL=kvara@test.com
set GIT1_PASSWORD=hunter22
REM ===============================

echo === Git1 RE-PAIR ^(admin^) ===
echo.

echo [1] Pinging Render server...
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

echo [4] Killing any existing agent...
taskkill /F /IM python.exe >nul 2>&1
timeout /t 1 /nobreak >nul

echo [5] Wiping old pairing token...
del "%APPDATA%\Git1\agent.json" >nul 2>&1
del "%APPDATA%\Git1\last-pair.txt" >nul 2>&1

echo [6] Starting agent...
if not exist "%REPO_DIR%\agent\.deps_installed" (
  pushd "%REPO_DIR%\agent" & call pip install -r requirements.txt & echo ok > .deps_installed & popd
)
start "Git1 Agent" cmd /k "set GIT1_SERVER=%GIT1_SERVER%&&cd /d %REPO_DIR%\agent && python agent.py"

echo [7] Waiting for fresh pairing code...
set CODE=
set /a tries=0
:wait_code
timeout /t 2 /nobreak >nul
set /a tries+=1
if %tries% gtr 30 ( echo Agent didn't print code. & pause & exit /b 1 )
if not exist "%APPDATA%\Git1\last-pair.txt" goto wait_code
for /f "usebackq delims=" %%c in ("%APPDATA%\Git1\last-pair.txt") do set "CODE=%%c"
if "%CODE%"=="" goto wait_code
echo     Pair code: %CODE%

echo [8] Auto-pairing device with token...
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Invoke-RestMethod -Uri '%GIT1_SERVER%/devices/pair' -Method Post -ContentType 'application/json' -Headers @{Authorization='Bearer %TOKEN%'} -Body '{\"code\":\"%CODE%\",\"name\":\"%COMPUTERNAME%\"}').id"`) do set "DEVICE_ID=%%i"
if "%DEVICE_ID%"=="" (
  echo     Pairing failed. Enter %CODE% manually in the app.
  pause & exit /b 1
)
echo     Device ID: %DEVICE_ID%

echo.
echo === Done ===
echo Device "%COMPUTERNAME%" paired with id %DEVICE_ID%.
echo Open the app -^> Devices -^> your PC should be there.
echo.
pause
endlocal
