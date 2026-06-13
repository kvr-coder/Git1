@echo off
REM ============================================================
REM  Git1 — Kid PC setup. Double-click this on the CHILD's PC.
REM  Self-elevates to Administrator, then runs the PowerShell
REM  installer (prereqs + clone + standard account + service).
REM
REM  Optional: edit the values below before running.
REM ============================================================

set "GIT1_SERVER=https://git1-server.onrender.com"
REM  Leave CHILD_USER blank to PICK an existing account when the installer runs
REM  (recommended — avoids creating a duplicate "Git1 Kid" account). Or set it
REM  to an existing account name to manage that account directly.
set "CHILD_USER="
REM  Branch the kid PC installs from AND self-updates against. Tracks main, which
REM  holds the fixes (dashboard-before-pairing, account picker, clearer pairing
REM  logs). The agent keeps pulling new commits from this branch.
set "BRANCH=main"

REM --- self-elevate ---
net session >nul 2>&1
if %errorlevel% NEQ 0 (
  echo Requesting Administrator rights...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Git1-Kid.ps1" ^
  -Server "%GIT1_SERVER%" -ChildUser "%CHILD_USER%" -Branch "%BRANCH%"

echo.
pause
