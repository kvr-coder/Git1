@echo off
REM ============================================================
REM  Git1 diagnostic - double-click to see what's broken.
REM  Shows: service status, env vars, config, last log lines,
REM         and runs the agent manually so you SEE the error.
REM ============================================================
net session >nul 2>&1
if %errorlevel% NEQ 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo ================================================
echo  Git1 DIAGNOSTIC
echo ================================================
echo.
echo --- 1. Service status ---
sc.exe query Git1Agent 2>nul || echo SERVICE NOT INSTALLED
echo.
echo --- 2. Service config (what python+args, what env) ---
sc.exe qc Git1Agent 2>nul
echo.
"C:\ProgramData\Git1\agent\.bin\nssm.exe" get Git1Agent Application 2>nul
"C:\ProgramData\Git1\agent\.bin\nssm.exe" get Git1Agent AppParameters 2>nul
"C:\ProgramData\Git1\agent\.bin\nssm.exe" get Git1Agent AppDirectory 2>nul
"C:\ProgramData\Git1\agent\.bin\nssm.exe" get Git1Agent AppEnvironmentExtra 2>nul
echo.
echo --- 3. Agent config (the token it's using) ---
if exist "C:\Windows\System32\config\systemprofile\AppData\Roaming\Git1\config.json" (
  echo SYSTEM config exists:
  type "C:\Windows\System32\config\systemprofile\AppData\Roaming\Git1\config.json"
  echo.
) else (
  echo No SYSTEM config.json - agent will generate a NEW pair code on next start.
)
echo.
echo --- 4. Last 30 lines of agent.log ---
if exist "C:\ProgramData\Git1\agent\agent.log" (
  powershell -NoProfile -Command "Get-Content 'C:\ProgramData\Git1\agent\agent.log' -Tail 30"
) else (
  echo agent.log does not exist - agent has never produced output.
)
echo.
echo --- 5. Running agent MANUALLY for 15 seconds (will show real error if any) ---
echo.
set "GIT1_SERVER=https://git1-server.onrender.com"
set "GIT1_CHILD_USER=Kiddo"
set "PYTHONUNBUFFERED=1"
start /B "" "C:\Program Files\Python312\python.exe" -u "C:\ProgramData\Git1\agent\agent.py"
timeout /t 15 /nobreak >nul
taskkill /F /IM python.exe >nul 2>&1
echo.
echo ================================================
echo  Done. Read the output above to see what failed.
echo ================================================
pause
