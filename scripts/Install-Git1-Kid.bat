@echo off
REM ============================================================
REM  Git1 — Kid PC setup. Double-click this on the CHILD's PC.
REM  Self-elevates to Administrator, then runs the PowerShell
REM  installer (prereqs + clone + standard account + service).
REM
REM  Single-file friendly: if Install-Git1-Kid.ps1 isn't next to
REM  this .bat, it is downloaded from GitHub automatically.
REM
REM  Optional: edit the values below before running.
REM ============================================================

set "GIT1_SERVER=https://git1-server.onrender.com"
set "CHILD_USER=Kiddo"
set "BRANCH=claude/setup-git1-dev-environment-QeNdU"
set "REPO_RAW=https://raw.githubusercontent.com/kvr-coder/git1"

REM --- self-elevate ---
net session >nul 2>&1
if %errorlevel% NEQ 0 (
  echo Requesting Administrator rights...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

set "PS1=%~dp0Install-Git1-Kid.ps1"

if not exist "%PS1%" (
  echo Install-Git1-Kid.ps1 not found next to this .bat — downloading from GitHub...
  powershell -NoProfile -Command ^
    "try { [Net.ServicePointManager]::SecurityProtocol = 'Tls12'; Invoke-WebRequest -UseBasicParsing -Uri '%REPO_RAW%/%BRANCH%/scripts/Install-Git1-Kid.ps1' -OutFile '%PS1%' } catch { Write-Host $_; exit 1 }"
  if not exist "%PS1%" (
    echo.
    echo Failed to download Install-Git1-Kid.ps1.
    echo Manual fix: download it from
    echo   %REPO_RAW%/%BRANCH%/scripts/Install-Git1-Kid.ps1
    echo and put it in the same folder as this .bat, then re-run.
    pause
    exit /b 1
  )
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" ^
  -Server "%GIT1_SERVER%" -ChildUser "%CHILD_USER%" -Branch "%BRANCH%"

echo.
pause
