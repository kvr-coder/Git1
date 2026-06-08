@echo off
REM ============================================================
REM  Git1 SAFE TRIAL. Arms a guaranteed auto-disarm timer so you
REM  can test the lock/recover loop without risk of getting stuck.
REM  Default: auto-disarms after 10 minutes.
REM
REM  Usage:  double-click            (10-min trial)
REM          Test-Git1.bat 5         (5-min trial)
REM          Test-Git1.bat cancel    (cancel the timer)
REM ============================================================
set "CHILD_USER=Kiddo"
set "ARG=%~1"

net session >nul 2>&1
if %errorlevel% NEQ 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -ArgumentList '%ARG%' -Verb RunAs"
  exit /b
)

if /I "%ARG%"=="cancel" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Test-Git1.ps1" -ChildUser "%CHILD_USER%" -Cancel
  goto done
)

set "MIN=%ARG%"
if "%MIN%"=="" set "MIN=10"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Test-Git1.ps1" -Minutes %MIN% -ChildUser "%CHILD_USER%"

:done
echo.
pause
