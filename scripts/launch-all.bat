@echo off
REM Git1 — launch server, mobile dev, and agent in separate windows.
REM Place this .bat anywhere (desktop, taskbar). It finds the repo via REPO_DIR below.

set REPO_DIR=C:\Users\Kvara\Git1

if not exist "%REPO_DIR%" (
  echo Repo not found at %REPO_DIR%
  echo Edit this .bat and update REPO_DIR.
  pause
  exit /b 1
)

echo === Git1 launcher ===
echo Repo: %REPO_DIR%
echo.

REM ---- 1. Server ----
echo [1/3] Starting server...
if not exist "%REPO_DIR%\server\node_modules" (
  echo First run: installing server dependencies...
  pushd "%REPO_DIR%\server"
  call npm install
  popd
)
start "Git1 Server" cmd /k "cd /d %REPO_DIR%\server && npm run dev"

REM ---- 2. Mobile dev server (Expo + tunnel + auto-pull) ----
echo [2/3] Starting mobile dev server...
if not exist "%REPO_DIR%\node_modules" (
  echo First run: installing mobile dependencies...
  pushd "%REPO_DIR%"
  call npm install
  popd
)
start "Git1 Mobile (Expo)" cmd /k "cd /d %REPO_DIR% && bash scripts/dev-watch.sh"

REM ---- 3. Agent (child PC service) ----
echo [3/3] Starting agent...
if not exist "%REPO_DIR%\agent\.deps_installed" (
  echo First run: installing agent dependencies...
  pushd "%REPO_DIR%\agent"
  call pip install -r requirements.txt
  echo done > .deps_installed
  popd
)
start "Git1 Agent" cmd /k "cd /d %REPO_DIR%\agent && python agent.py"

echo.
echo All three components launched in separate windows.
echo Close each window to stop that component.
timeout /t 5
