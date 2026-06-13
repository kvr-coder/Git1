@echo off
REM Renames the existing token file to what the agent expects, restarts service.
REM Single purpose. Should take 5 seconds.

net session >nul 2>&1
if %errorlevel% NEQ 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

set "DIR=C:\Windows\System32\config\systemprofile\AppData\Roaming\Git1"
echo Fixing token file location...

if exist "%DIR%\config.json" (
  if exist "%DIR%\agent.json" del "%DIR%\agent.json" >nul 2>&1
  move /Y "%DIR%\config.json" "%DIR%\agent.json"
  echo Renamed config.json -> agent.json
) else (
  if exist "%DIR%\agent.json" (
    echo Already renamed - agent.json exists.
  ) else (
    echo ERROR: No token file found at %DIR%
    echo You need to re-pair from the installer.
    pause
    exit /b 1
  )
)

echo Restarting Git1Agent service...
net stop Git1Agent >nul 2>&1
net start Git1Agent
if errorlevel 1 (
  echo Service did not start. Run Fix-Service.bat first to reinstall it.
  pause
  exit /b 1
)

echo.
echo Done. Watch the dashboard - device should turn ONLINE within 5 seconds.
echo.
timeout /t 7 /nobreak >nul
echo.
echo === Last 10 log lines ===
powershell -NoProfile -Command "Get-Content 'C:\ProgramData\Git1\agent\agent.log' -Tail 10"
echo.
pause
