@echo off
REM Read-only Git1 status. Does NOT kill or restart anything.
net session >nul 2>&1
if %errorlevel% NEQ 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
echo ================================================
echo  Git1 STATUS (read-only)
echo ================================================
echo.
echo --- Service state ---
sc.exe query Git1Agent | findstr "STATE" 2>nul || echo SERVICE NOT INSTALLED
echo.
echo --- Token file (is it SIGNED? signed tokens contain a dot) ---
set "CFG=C:\Windows\System32\config\systemprofile\AppData\Roaming\Git1\agent.json"
if exist "%CFG%" (
  powershell -NoProfile -Command "$j=Get-Content '%CFG%' -Raw | ConvertFrom-Json; $t=$j.agentToken; if($t -match '\.'){Write-Host '  SIGNED token (good):' ($t.Substring(0,[Math]::Min(30,$t.Length))+'...')} else {Write-Host '  OLD UNSIGNED token (needs re-pair):' ($t.Substring(0,[Math]::Min(20,$t.Length))+'...')}"
) else (
  echo   No agent.json - agent will generate a pair code.
)
echo.
echo --- Live connection (last 20 log lines) ---
if exist "C:\ProgramData\Git1\agent\agent.log" (
  powershell -NoProfile -Command "Get-Content 'C:\ProgramData\Git1\agent\agent.log' -Tail 20"
) else (
  echo   No log yet.
)
echo.
echo --- What commit is the agent code on? ---
git -C C:\ProgramData\Git1 log --oneline -1 2>nul
echo.
echo ================================================
echo Look above:
echo   * STATE should be RUNNING
echo   * token should say SIGNED
echo   * log should end with [ws] connected
echo ================================================
pause
