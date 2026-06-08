# Remove the Git1 agent service + watchdog (run as Administrator).
param([string]$ServiceName = "Git1Agent")
$ErrorActionPreference = "SilentlyContinue"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
        ).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
  Start-Process powershell -Verb RunAs -ArgumentList `
    "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -ServiceName $ServiceName"
  exit
}

# Remove watchdog first so it doesn't resurrect the service.
Unregister-ScheduledTask -TaskName "Git1AgentWatchdog" -Confirm:$false
Write-Host "[svc] watchdog removed."

$nssm = (Get-Command nssm.exe -ErrorAction SilentlyContinue).Source
if (-not $nssm) { $nssm = Join-Path (Resolve-Path "$PSScriptRoot\..\agent").Path ".bin\nssm.exe" }
if (Test-Path $nssm) {
  & $nssm stop $ServiceName
  & $nssm remove $ServiceName confirm
} else {
  & sc.exe stop $ServiceName | Out-Null
  & sc.exe delete $ServiceName | Out-Null
}
Write-Host "[svc] service '$ServiceName' removed."
Write-Host "Note: this does NOT clear logon-hour restrictions. To restore 24/7 access:"
Write-Host "  net user <child> /times:all"
