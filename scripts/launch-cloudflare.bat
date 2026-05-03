@echo off
setlocal enabledelayedexpansion
REM === Git1 one-click launcher ===
REM Copy this file to your desktop. Double-click. It opens 4 windows:
REM   1) Backend server (Node, port 8080)
REM   2) Cloudflare quick tunnel (public URL for the server)
REM   3) Agent (Python, with GIT1_SERVER pointed at the tunnel)
REM   4) Expo Metro in TUNNEL mode (works from any network)
REM
REM Edit REPO_DIR if your clone is somewhere other than C:\Users\Kvara\Git1.

set REPO_DIR=C:\Users\Kvara\Git1

if not exist "%REPO_DIR%" (
  echo Could not find %REPO_DIR%. Edit REPO_DIR in this .bat.
  pause
  exit /b 1
)

echo === Git1 launcher ===
echo Repo: %REPO_DIR%
echo.

echo [0/4] Killing stale node processes...
taskkill /F /IM node.exe >nul 2>&1

echo [1/4] Starting backend server on :8080
if not exist "%REPO_DIR%\server\node_modules" (
  echo     First run: installing server deps...
  pushd "%REPO_DIR%\server"
  call npm install
  popd
)
start "Git1 Server" cmd /k "cd /d %REPO_DIR%\server && npm run dev"
timeout /t 5 /nobreak >nul

set TUNLOG=%TEMP%\git1-tunnel.log
del "%TUNLOG%" >nul 2>&1
echo [2/4] Starting Cloudflare tunnel...
start "Git1 Tunnel" cmd /k "cloudflared tunnel --url http://localhost:8080 --logfile %TUNLOG%"

echo     Waiting up to 60s for public URL...
set URL=
set /a tries=0
:wait_url
timeout /t 2 /nobreak >nul
set /a tries+=1
if %tries% gtr 30 goto no_url
if not exist "%TUNLOG%" goto wait_url
for /f "delims=" %%u in ('powershell -NoProfile -Command "$m = Select-String -Path '%TUNLOG%' -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -List; if ($m) { $m.Matches[0].Value }"') do set URL=%%u
if "%URL%"=="" goto wait_url

echo     URL: %URL%
echo|set /p="%URL%" | clip
echo     (copied to clipboard)

echo [3/4] Starting agent (GIT1_SERVER=%URL%)
if not exist "%REPO_DIR%\agent\.deps_installed" (
  echo     First run: installing agent deps...
  pushd "%REPO_DIR%\agent"
  call pip install -r requirements.txt
  echo ok > .deps_installed
  popd
)
start "Git1 Agent" cmd /k "set GIT1_SERVER=%URL% && cd /d %REPO_DIR%\agent && python agent.py"
goto launch_expo

:no_url
echo     Tunnel didn't come up in 60s. Open the Git1 Tunnel window to debug.
echo     Starting agent in LAN mode (localhost) so you can still pair locally.
start "Git1 Agent" cmd /k "cd /d %REPO_DIR%\agent && python agent.py"

:launch_expo
echo [4/4] Starting Expo in TUNNEL mode (works from any network)
if not exist "%REPO_DIR%\node_modules" (
  echo     First run: installing mobile deps...
  pushd "%REPO_DIR%"
  call npm install --legacy-peer-deps
  popd
)
REM @expo/ngrok required by `expo start --tunnel`
call npm list -g @expo/ngrok --depth=0 >nul 2>&1
if errorlevel 1 (
  echo     Installing @expo/ngrok globally one-time...
  call npm install -g @expo/ngrok@^4.1.0
)
start "Git1 Expo" cmd /k "cd /d %REPO_DIR% && npx expo start --tunnel --clear"

echo.
echo === Done ===
if not "%URL%"=="" (
  echo Server URL ^(also in clipboard^):
  echo     %URL%
  echo On your phone: app -^> Settings -^> Server URL -^> paste -^> Save.
)
echo.
echo Four windows are open. Close any to stop that piece.
pause
endlocal
