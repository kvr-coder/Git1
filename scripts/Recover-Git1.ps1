<#
  Recover-Git1.ps1 — EMERGENCY OFF SWITCH. Fully disarms Git1 on this PC.
  Works entirely offline (no server needed). Run as Administrator.

  Removes every enforcement mechanism:
    * stops + removes the watchdog scheduled task (so it can't revive anything)
    * stops + removes the Git1Agent service
    * clears the child's logon-hour restriction  (net user /times:all)
    * deletes the firewall block rules            (internet restored)
    * wipes the cached policy                      (no sticky lock on next run)

  If you are being re-locked every few seconds and can't even type, reboot into
  SAFE MODE first (hold Shift -> Restart -> Troubleshoot -> Advanced -> Startup
  Settings -> Restart -> 4). The service/watchdog don't run in Safe Mode, so
  you can run this script there cleanly.
#>
param(
  [string]$ChildUser  = "Kiddo",
  [string]$ServiceName = "Git1Agent",
  [string]$InstallDir = "C:\ProgramData\Git1"
)
$ErrorActionPreference = "SilentlyContinue"

# self-elevate
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
        ).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
  Start-Process powershell -Verb RunAs -ArgumentList `
    "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -ChildUser $ChildUser"
  exit
}

Write-Host "=== Git1 emergency recovery ===" -ForegroundColor Cyan

Write-Host "[1/5] Removing watchdog task..."
Unregister-ScheduledTask -TaskName "Git1AgentWatchdog" -Confirm:$false

Write-Host "[2/5] Stopping + removing service..."
$nssm = (Get-Command nssm.exe -ErrorAction SilentlyContinue).Source
if (-not $nssm) { $nssm = Join-Path $InstallDir "agent\.bin\nssm.exe" }
if (Test-Path $nssm) { & $nssm stop $ServiceName; & $nssm remove $ServiceName confirm }
else { & sc.exe stop $ServiceName | Out-Null; & sc.exe delete $ServiceName | Out-Null }

Write-Host "[3/5] Clearing logon-hour restriction for '$ChildUser'..."
& net user $ChildUser /times:all

Write-Host "[4/5] Deleting firewall block rules (internet restored)..."
& netsh advfirewall firewall delete rule name="Git1BlockChild" | Out-Null
& netsh advfirewall firewall delete rule name="Git1Block"      | Out-Null
& netsh advfirewall firewall delete rule name="Git1AllowAgent" | Out-Null

Write-Host "[5/5] Wiping cached policy (no sticky lock next start)..."
Remove-Item (Join-Path $env:APPDATA "Git1\policy.json") -Force
Remove-Item "C:\Windows\System32\config\systemprofile\AppData\Roaming\Git1\policy.json" -Force

Write-Host "`nDone. Git1 is fully disarmed on this PC." -ForegroundColor Green
Write-Host "Internet + logon are unrestricted, and nothing will restart."
Write-Host "Re-install later with Install-Git1-Kid.bat."
