@echo off
REM ============================================================
REM  Git1 RE-PAIR (recovery code). Use when the kid wiped or
REM  reinstalled the agent and the parent has issued a fresh
REM  6-digit recovery code from the dashboard.
REM
REM  This is NOT the emergency off-switch — that's Recover-Git1.bat.
REM  This file keeps Git1 running and just rotates the agent token
REM  so the new install reconnects to the same parent account
REM  without losing settings/history.
REM
REM  Usage:
REM    1. Parent opens https://git1-server.onrender.com on phone
REM       -> taps "Recovery code" on the kid device card
REM       -> shares the 6-digit code with you
REM    2. Double-click this file on the kid PC (it self-elevates)
REM    3. Enter the 6-digit code when prompted
REM    4. Done — the running agent picks it up within 60 seconds
REM ============================================================
net session >nul 2>&1
if %errorlevel% NEQ 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Repair-Pair-Git1.ps1"
echo.
pause
