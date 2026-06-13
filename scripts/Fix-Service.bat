@echo off
REM ============================================================
REM  Git1 SERVICE REPAIR. Reinstalls just the Windows service
REM  for the currently logged-in user. Use when:
REM   - dashboard shows "offline" but agent.log shows it works
REM   - service is missing (Check-Git1.bat says "SERVICE NOT INSTALLED")
REM   - agent is locking the wrong user
REM ============================================================
if not defined GIT1_INSTALL_USER set "GIT1_INSTALL_USER=%USERNAME%"

net session >nul 2>&1
if %errorlevel% NEQ 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs -ArgumentList '%GIT1_INSTALL_USER%'"
  exit /b
)
if not "%~1"=="" set "GIT1_INSTALL_USER=%~1"

echo ================================================
echo  Git1 SERVICE REPAIR for user: %GIT1_INSTALL_USER%
echo ================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$user='%GIT1_INSTALL_USER%';" ^
  "$installDir='C:\ProgramData\Git1';" ^
  "$server='https://git1-server.onrender.com';" ^
  "$branch='claude/setup-git1-dev-environment-QeNdU';" ^
  "Write-Host '[1/6] Pulling latest agent code...'; git -C $installDir fetch origin $branch 2>&1 | Out-Host; git -C $installDir checkout $branch 2>&1 | Out-Host; git -C $installDir pull --ff-only origin $branch 2>&1 | Out-Host;" ^
  "Write-Host '[2/6] Verifying agent token...'; $cfg='C:\Windows\System32\config\systemprofile\AppData\Roaming\Git1\config.json'; if (Test-Path $cfg) { Write-Host '  config.json exists - token preserved.' } else { Write-Host '  NO config.json - you need to re-pair.' -ForegroundColor Yellow };" ^
  "Write-Host \"[3/6] Running install-service.ps1 for user '$user'...\"; & (Join-Path $installDir 'scripts\install-service.ps1') -Server $server -ChildUser $user -UpdateBranch $branch 2>&1 | Out-Host;" ^
  "Write-Host '[4/6] Verifying service exists...'; $svc = Get-Service Git1Agent -ErrorAction SilentlyContinue; if ($svc) { Write-Host ('  Service exists. Status: ' + $svc.Status) -ForegroundColor Green } else { Write-Host '  SERVICE STILL MISSING - install failed.' -ForegroundColor Red };" ^
  "Write-Host '[5/6] Checking env vars...'; $nssm = Join-Path $installDir 'agent\.bin\nssm.exe'; if (Test-Path $nssm) { & $nssm get Git1Agent AppEnvironmentExtra 2>&1 | Out-Host };" ^
  "Write-Host '[6/6] Starting service...'; Start-Service Git1Agent -ErrorAction SilentlyContinue; Start-Sleep 5; $svc = Get-Service Git1Agent -ErrorAction SilentlyContinue; if ($svc) { Write-Host ('  Service: ' + $svc.Status) -ForegroundColor Green };" ^
  "Write-Host ''; Write-Host '=== Last 15 log lines ==='; if (Test-Path \"$installDir\agent\agent.log\") { Get-Content \"$installDir\agent\agent.log\" -Tail 15 }"

echo.
echo ================================================
echo Done. If service is RUNNING and log shows [ws] connected,
echo the dashboard will show ONLINE within 5 seconds.
echo ================================================
pause
