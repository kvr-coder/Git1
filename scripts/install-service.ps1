# Git1 agent — one-click hardened service installer (run as Administrator).
#
# Installs the Python agent as a LocalSystem Windows service so that:
#   * it starts at boot, before any user logs in;
#   * a Standard-user child cannot kill it from Task Manager;
#   * the SCM auto-restarts it if it crashes OR is killed (failureflag 1);
#   * a SYSTEM watchdog scheduled task revives it if the service is deleted;
#   * the child's user SID is wired in so the per-SID internet block works.
#
# Usage (PowerShell as Admin):
#   .\install-service.ps1 -Server https://git1-server.onrender.com -ChildUser Kiddo
#
param(
  [string]$Server   = $env:GIT1_SERVER,
  [string]$ChildUser = $env:GIT1_CHILD_USER,
  [string]$ServiceName = "Git1Agent",
  # Branch the agent self-updates from. MUST be one only you push to (its code
  # runs as SYSTEM). Defaults to this checkout's current branch.
  [string]$UpdateBranch = ""
)

$ErrorActionPreference = "Stop"

# --- self-elevate ---
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
        ).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
  Write-Host "Elevating to Administrator..."
  $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  if ($Server)    { $argList += " -Server `"$Server`"" }
  if ($ChildUser) { $argList += " -ChildUser `"$ChildUser`"" }
  Start-Process powershell -Verb RunAs -ArgumentList $argList
  exit
}

$AgentDir = (Resolve-Path "$PSScriptRoot\..\agent").Path
$AgentPy  = Join-Path $AgentDir "agent.py"
$LogFile  = Join-Path $AgentDir "agent.log"

# --- locate python ---
$python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $python) { $python = (Get-Command py -ErrorAction SilentlyContinue).Source }
if (-not $python) { throw "Python not found on PATH. Install Python 3 first." }
Write-Host "[svc] python: $python"
Write-Host "[svc] agent : $AgentPy"

# --- resolve child SID (for the per-SID internet block) ---
$ChildSid = ""
if ($ChildUser) {
  try {
    $ChildSid = (New-Object System.Security.Principal.NTAccount($ChildUser)
                ).Translate([System.Security.Principal.SecurityIdentifier]).Value
    Write-Host "[svc] child '$ChildUser' SID: $ChildSid"
  } catch {
    Write-Warning "Could not resolve SID for '$ChildUser': $_  (internet block will fall back to console user)"
  }
}

# --- ensure NSSM is available (download if missing) ---
$nssm = (Get-Command nssm.exe -ErrorAction SilentlyContinue).Source
if (-not $nssm) {
  $nssmDir = Join-Path $AgentDir ".bin"
  $nssm = Join-Path $nssmDir "nssm.exe"
  if (-not (Test-Path $nssm)) {
    New-Item -ItemType Directory -Force -Path $nssmDir | Out-Null
    $zip = $null

    # 1. Look for nssm.zip the user dropped locally (preferred — no network).
    $localCandidates = @(
      "$env:USERPROFILE\Downloads\nssm-2.24.zip",
      "$env:USERPROFILE\Downloads\nssm.zip",
      "C:\Users\Public\Downloads\nssm-2.24.zip",
      "$PSScriptRoot\nssm-2.24.zip",
      (Join-Path $AgentDir "nssm-2.24.zip")
    )
    # Also scan all drive roots for nssm-2.24.zip (USB sticks etc).
    foreach ($d in (Get-PSDrive -PSProvider FileSystem)) {
      $localCandidates += (Join-Path $d.Root "nssm-2.24.zip")
    }
    foreach ($p in $localCandidates) {
      if (Test-Path $p) { Write-Host "[svc] using local NSSM: $p"; $zip = $p; break }
    }

    # 2. Otherwise, try mirrors with retry.
    if (-not $zip) {
      $zip = Join-Path $env:TEMP "nssm.zip"
      $mirrors = @(
        "https://nssm.cc/release/nssm-2.24.zip",
        "https://web.archive.org/web/2024/https://nssm.cc/release/nssm-2.24.zip"
      )
      $ok = $false
      foreach ($url in $mirrors) {
        for ($i=1; $i -le 3; $i++) {
          try {
            Write-Host "[svc] trying $url (attempt $i)"
            Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $zip -TimeoutSec 30
            if ((Get-Item $zip).Length -gt 100000) { $ok = $true; break }
          } catch { Write-Host "[svc]   failed: $_" }
          Start-Sleep -Seconds ($i * 2)
        }
        if ($ok) { break }
      }
      if (-not $ok) {
        Write-Host ""
        Write-Host "Could not download NSSM. Easy fix:" -ForegroundColor Yellow
        Write-Host "  1. On any PC with internet, download: https://nssm.cc/release/nssm-2.24.zip"
        Write-Host "  2. Put nssm-2.24.zip in this PC's Downloads folder (or anywhere)"
        Write-Host "  3. Re-run the installer"
        throw "NSSM not available."
      }
    }

    $tmp = Join-Path $env:TEMP "nssm-extract"
    if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
    Expand-Archive -Force $zip $tmp
    $arch = if ([Environment]::Is64BitOperatingSystem) { "win64" } else { "win32" }
    Copy-Item (Join-Path $tmp "nssm-2.24\$arch\nssm.exe") $nssm -Force
  }
}
Write-Host "[svc] nssm: $nssm"

# --- (re)install the service ---
& $nssm stop $ServiceName 2>$null | Out-Null
& $nssm remove $ServiceName confirm 2>$null | Out-Null

& $nssm install $ServiceName $python $AgentPy
& $nssm set $ServiceName AppDirectory $AgentDir
& $nssm set $ServiceName AppStdout $LogFile
& $nssm set $ServiceName AppStderr $LogFile
& $nssm set $ServiceName AppRotateFiles 1
& $nssm set $ServiceName Start SERVICE_AUTO_START
& $nssm set $ServiceName ObjectName LocalSystem

# Environment for the agent (server URL + child identity for SID-scoped block).
$envPairs = @()
if (-not $UpdateBranch) {
  try { $UpdateBranch = (git -C $AgentDir rev-parse --abbrev-ref HEAD).Trim() } catch {}
}
if ($Server)       { $envPairs += "GIT1_SERVER=$Server" }
if ($ChildUser)    { $envPairs += "GIT1_CHILD_USER=$ChildUser" }
if ($ChildSid)     { $envPairs += "GIT1_CHILD_SID=$ChildSid" }
if ($UpdateBranch) { $envPairs += "GIT1_UPDATE_BRANCH=$UpdateBranch" }
if ($envPairs.Count -gt 0) {
  & $nssm set $ServiceName AppEnvironmentExtra ($envPairs -join "`n")
}

# --- robust recovery: restart on crash OR kill, forever ---
# failureflag 1 => treat a process kill (not just clean crash) as a failure.
& sc.exe failure $ServiceName reset= 0 actions= restart/5000/restart/5000/restart/5000 | Out-Null
& sc.exe failureflag $ServiceName 1 | Out-Null

& $nssm start $ServiceName
Write-Host "[svc] installed and started '$ServiceName'."

# --- watchdog: SYSTEM scheduled task that revives the service if deleted ---
$watchdog = Join-Path $PSScriptRoot "service-watchdog.ps1"
if (Test-Path $watchdog) {
  Write-Host "[svc] installing watchdog scheduled task..."
  $action  = New-ScheduledTaskAction -Execute "powershell.exe" `
              -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$watchdog`" -ServiceName $ServiceName"
  $atStart = New-ScheduledTaskTrigger -AtStartup
  $repeat  = New-ScheduledTaskTrigger -Once -At (Get-Date) `
              -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
  $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
  Register-ScheduledTask -TaskName "Git1AgentWatchdog" -Action $action `
    -Trigger @($atStart, $repeat) -Principal $principal -Force | Out-Null
  Write-Host "[svc] watchdog 'Git1AgentWatchdog' installed (checks every 5 min)."
}

Write-Host ""
Write-Host "Done. IMPORTANT for real enforcement:"
Write-Host "  * The CHILD account must be a STANDARD user (not Administrator),"
Write-Host "    otherwise they can stop the service and bypass logon hours."
Write-Host "  * First run prints a pairing code to: $LogFile"
Write-Host "    Tail it with:  Get-Content `"$LogFile`" -Wait"
