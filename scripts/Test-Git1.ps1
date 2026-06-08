<#
  Test-Git1.ps1 — SAFE TRIAL. Verify the lock/recover loop with a guaranteed
  auto-disarm, so you can trust Git1 before relying on it.

  It schedules a SYSTEM "dead-man" task that runs Recover-Git1.ps1 after N
  minutes (default 10). Even if a lock misbehaves, the PC fully disarms itself
  when the timer fires — you cannot get stuck. Run as Administrator.

  Then, during the trial window, test from your phone:
    * Lock the kid device  -> log into the KID account, confirm it locks;
      log into YOUR admin account, confirm it does NOT lock.
    * Toggle internet off   -> kid loses net, your admin session keeps it.
    * Run Recover-Git1.bat  -> everything disarms immediately.
  If you do nothing, it auto-disarms at the deadline anyway.

  Cancel the timer early any time:  Test-Git1.ps1 -Cancel
#>
param(
  [int]$Minutes      = 10,
  [string]$ChildUser = "Kiddo",
  [string]$InstallDir = "C:\ProgramData\Git1",
  [switch]$Cancel
)
$ErrorActionPreference = "Stop"
$TaskName = "Git1SafetyTimer"

# self-elevate
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
        ).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
  $a = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Minutes $Minutes -ChildUser $ChildUser"
  if ($Cancel) { $a += " -Cancel" }
  Start-Process powershell -Verb RunAs -ArgumentList $a
  exit
}

if ($Cancel) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Safety timer cancelled. (Enforcement, if armed, stays on — run Recover-Git1.bat to disarm.)" -ForegroundColor Yellow
  return
}

$recover = Join-Path $InstallDir "scripts\Recover-Git1.ps1"
if (-not (Test-Path $recover)) { throw "Recover-Git1.ps1 not found at $recover — run the installer first." }

$when = (Get-Date).AddMinutes($Minutes)
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$recover`" -ChildUser $ChildUser"
# Fire at the deadline AND at startup (covers reboot/sleep during the trial).
$trigger = New-ScheduledTaskTrigger -Once -At $when
$atBoot  = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger @($trigger, $atBoot) `
  -Principal $principal -Force | Out-Null

Write-Host "=== Git1 SAFE TRIAL armed ===" -ForegroundColor Cyan
Write-Host ("Auto-disarm at {0:HH:mm:ss} (in {1} min). You cannot get stuck." -f $when, $Minutes) -ForegroundColor Green
Write-Host ""
Write-Host "Test now from your phone:"
Write-Host "  1. Lock the kid device. Log into the '$ChildUser' account -> should lock."
Write-Host "     Log into YOUR admin account -> should NOT lock, keeps internet."
Write-Host "  2. Toggle internet off -> only '$ChildUser' loses net."
Write-Host "  3. Double-click Recover-Git1.bat -> disarms instantly."
Write-Host ""
Write-Host "Cancel the timer early:  Test-Git1.ps1 -Cancel"
