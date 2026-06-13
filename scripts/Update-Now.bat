@echo off
REM ============================================================
REM  Git1 UPDATE NOW. Pulls the latest agent code and restarts
REM  the service so fixes apply immediately (instead of waiting
REM  up to 20 min for the auto-updater).
REM ============================================================
net session >nul 2>&1
if %errorlevel% NEQ 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

set "DIR=C:\ProgramData\Git1"
echo === Pulling latest agent code ===
git -C "%DIR%" fetch origin claude/setup-git1-dev-environment-QeNdU
git -C "%DIR%" reset --hard origin/claude/setup-git1-dev-environment-QeNdU
echo.
echo === Current commit ===
git -C "%DIR%" log --oneline -1
echo.
echo === Restarting Git1Agent ===
net stop Git1Agent
net start Git1Agent
echo.
echo === Waiting for agent to connect ===
timeout /t 8 /nobreak >nul
powershell -NoProfile -Command "Get-Content '%DIR%\agent\agent.log' -Tail 12"
echo.
echo Done. The kid PC now runs the latest code.
echo (Schedules, lock fix, stats, etc. are live.)
pause
