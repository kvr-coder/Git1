<#
  Repair-Pair-Git1.ps1 — drops a parent-issued 6-digit recovery code into the
  agent's CONFIG_DIR so it re-pairs to the existing device record without the
  kid touching anything. The running agent reads the file on its next WS
  reconnect (within ~60s), rotates to the fresh agentToken, and deletes
  recovery.txt. Settings, schedules, bank balance, and history are preserved.

  See agent/recovery.py for the consumer side.
#>
param([string]$Code)

$ErrorActionPreference = "Stop"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
        ).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
  Start-Process powershell -Verb RunAs -ArgumentList `
    "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  exit
}

Write-Host "=== Git1 re-pair (recovery code) ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Get the 6-digit code from the parent dashboard:"
Write-Host "  Sign in -> tap the kid device card -> 'Recovery code'"
Write-Host ""

if (-not $Code) { $Code = Read-Host "Enter the 6-digit recovery code" }
$Code = $Code.Trim()

if ($Code -notmatch '^\d{6}$') {
  Write-Host "Not a 6-digit code. Aborted." -ForegroundColor Red
  exit 1
}

# The Windows service runs as LocalSystem, so the agent's CONFIG_DIR is in
# SYSTEM's APPDATA, not the interactive user's. Write to both so it works
# whether the agent is running as a service or as the kid in console mode.
$systemConfigDir = "C:\Windows\System32\config\systemprofile\AppData\Roaming\Git1"
$userConfigDir   = Join-Path $env:APPDATA "Git1"

$wrote = 0
foreach ($dir in @($systemConfigDir, $userConfigDir)) {
  try {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    Set-Content -Path (Join-Path $dir "recovery.txt") -Value $Code -NoNewline
    Write-Host "  + wrote $dir\recovery.txt"
    $wrote++
  } catch {
    Write-Host "  ! could not write to $dir : $_" -ForegroundColor Yellow
  }
}

if ($wrote -eq 0) {
  Write-Host "Failed to write recovery file anywhere." -ForegroundColor Red
  exit 2
}

# Nudge the service so it reconnects fast instead of waiting up to 60s.
try {
  Restart-Service -Name "Git1Agent" -ErrorAction Stop
  Write-Host ""
  Write-Host "Git1Agent service restarted. The agent will pick up the new" -ForegroundColor Green
  Write-Host "code on its next WebSocket connect (within a few seconds)."
} catch {
  Write-Host ""
  Write-Host "Recovery code written. The running agent will pick it up on its" -ForegroundColor Green
  Write-Host "next reconnect (within ~60 seconds)."
  Write-Host "(Note: the Git1Agent service wasn't found or couldn't be restarted;"
  Write-Host " if you run the agent manually, restart it now.)"
}

Write-Host ""
Write-Host "Confirm on the parent dashboard that the device shows 'online'." -ForegroundColor Cyan
