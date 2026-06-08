@echo off
REM ============================================================
REM  Git1 EMERGENCY OFF SWITCH. Double-click to fully disarm
REM  Git1 on this PC (stops service+watchdog, restores internet
REM  and logon, clears sticky lock). Works offline.
REM
REM  If you're being re-locked every few seconds: reboot into
REM  SAFE MODE first, then run this.
REM ============================================================
set "CHILD_USER=Kiddo"

net session >nul 2>&1
if %errorlevel% NEQ 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Recover-Git1.ps1" -ChildUser "%CHILD_USER%"
echo.
pause
