@echo off
REM ============================================================
REM  Git1 UPDATE (no admin needed). Double-click any time you
REM  want the kid PC to pull the latest version right away.
REM
REM  This just asks the running Git1 agent (which is SYSTEM) to
REM  update itself — so it works WITHOUT administrator rights.
REM  The agent picks up the request within ~5 seconds, pulls the
REM  latest code, and restarts itself.
REM ============================================================
set "IPC=C:\Users\Public\Git1"

if not exist "%IPC%" mkdir "%IPC%" 2>nul

echo Requesting update...> "%IPC%\update.request"

if exist "%IPC%\update.request" (
  echo.
  echo  Update requested. The Git1 agent will pull the latest
  echo  version and restart within about 5-10 seconds.
  echo.
  echo  You can close this window.
) else (
  echo.
  echo  Could not write the update request. Is Git1 installed?
)
echo.
pause
