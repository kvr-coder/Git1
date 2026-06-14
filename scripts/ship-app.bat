@echo off
REM ============================================================
REM  Ship a JS/UI update to the installed "timeoff" iOS app
REM  over-the-air (no rebuild, no TestFlight). ~1 minute.
REM
REM  Use this for: screen changes, logic, bug fixes, styling.
REM  Do NOT use for: new native modules, icon, permissions,
REM  app.json plugin changes, or a version bump -> those need
REM  a full "eas build -p ios --profile preview" instead.
REM
REM  Usage:  ship-app.bat "what changed"
REM ============================================================
setlocal

if "%~1"=="" (
  set /p MSG="Describe what changed: "
) else (
  set "MSG=%~1"
)

echo.
echo === Pulling latest code ===
git pull
if errorlevel 1 (
  echo Git pull failed - resolve conflicts then re-run.
  pause & exit /b 1
)

echo.
echo === Installing any new deps ===
call npm install

echo.
echo === Publishing OTA update to the "preview" channel ===
call eas update --branch preview --platform ios --message "%MSG%"
if errorlevel 1 (
  echo.
  echo Update failed. If this is the first run, run once:
  echo     eas update:configure
  echo then try again.
  pause & exit /b 1
)

echo.
echo Done. Open "timeoff" on your iPhone - it pulls the update
echo on next launch (or pull-to-refresh if already open).
echo.
pause
