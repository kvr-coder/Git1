@echo off
REM Git1 one-click launcher: server + Cloudflare tunnel + agent + Expo.
REM Copy this file to your desktop. Edit REPO_DIR below if your clone is elsewhere.

set REPO_DIR=C:\Users\Kvara\Git1

if not exist "%REPO_DIR%\scripts\launch-cloudflare.ps1" (
  echo Could not find launch script at %REPO_DIR%\scripts\launch-cloudflare.ps1
  echo Edit this .bat and update REPO_DIR.
  pause
  exit /b 1
)

powershell -ExecutionPolicy Bypass -File "%REPO_DIR%\scripts\launch-cloudflare.ps1"
