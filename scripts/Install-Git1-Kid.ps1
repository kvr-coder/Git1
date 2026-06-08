<#
  Install-Git1-Kid.ps1 — set up the Git1 agent on a CHILD's Windows PC.

  Run once (the .bat wrapper self-elevates to Administrator). From zero it:
    1. ensures Python 3 + Git are installed (via winget if missing)
    2. clones the repo to a protected location the kid can't edit
    3. installs the agent's Python dependencies
    4. creates a dedicated STANDARD (non-admin) account for the child
    5. installs the hardened LocalSystem service + watchdog (install-service.ps1)
    6. starts it and shows the pairing code to enter in the parent app

  Plain script (no packed .exe) so antivirus doesn't quarantine it, and so the
  agent stays a git checkout that can self-update on every push.

  Example:
    .\Install-Git1-Kid.ps1 -Server https://git1-server.onrender.com `
        -ChildUser Kiddo -Branch claude/setup-git1-dev-environment-QeNdU
#>
param(
  [string]$Server      = "https://git1-server.onrender.com",
  [string]$ChildUser   = "Kiddo",
  [string]$ChildPassword = "",                 # blank = passwordless kid login
  [string]$Branch      = "claude/setup-git1-dev-environment-QeNdU",
  [string]$RepoUrl     = "https://github.com/kvr-coder/git1.git",
  [string]$InstallDir  = "C:\ProgramData\Git1" # outside the kid's profile
)

$ErrorActionPreference = "Stop"
function Step($m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }

# --- 0. must be admin (the .bat elevates; double-check here) ---
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
        ).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
  throw "Run as Administrator (use Install-Git1-Kid.bat)."
}

# --- 1. prerequisites: Python + Git ---
Step "Checking prerequisites (Python, Git)"
function Have($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function Winget-Install($id) {
  if (Have winget) {
    Write-Host "  installing $id via winget..."
    winget install --id $id -e --silent --accept-source-agreements --accept-package-agreements
  } else {
    throw "winget not available and $id is missing. Install $id manually, then re-run."
  }
}
if (-not (Have python)) { Winget-Install "Python.Python.3.12" }
if (-not (Have git))    { Winget-Install "Git.Git" }
# refresh PATH for this session so the just-installed tools are visible
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path","User")
if (-not (Have python)) { throw "Python still not found after install — open a new shell and re-run." }
if (-not (Have git))    { throw "Git still not found after install — open a new shell and re-run." }

# --- 2. clone (or update) the repo into a protected location ---
Step "Fetching agent code -> $InstallDir"
if (Test-Path (Join-Path $InstallDir ".git")) {
  git -C $InstallDir fetch origin $Branch
  git -C $InstallDir checkout $Branch
  git -C $InstallDir pull --ff-only origin $Branch
} else {
  git clone --branch $Branch $RepoUrl $InstallDir
}
# Lock down: only Administrators/SYSTEM can modify (kid can't tamper with code).
icacls $InstallDir /inheritance:r /grant:r "Administrators:(OI)(CI)F" "SYSTEM:(OI)(CI)F" "Users:(OI)(CI)RX" | Out-Null

# --- 3. python deps ---
Step "Installing Python dependencies"
python -m pip install --upgrade pip | Out-Null
python -m pip install -r (Join-Path $InstallDir "agent\requirements.txt")

# --- 4. create the dedicated STANDARD child account ---
Step "Creating standard account '$ChildUser'"
$existing = Get-LocalUser -Name $ChildUser -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "  account already exists — leaving it as-is."
} else {
  if ($ChildPassword) {
    $sec = ConvertTo-SecureString $ChildPassword -AsPlainText -Force
    New-LocalUser -Name $ChildUser -Password $sec -PasswordNeverExpires -FullName "Git1 Kid" | Out-Null
  } else {
    New-LocalUser -Name $ChildUser -NoPassword -FullName "Git1 Kid" | Out-Null
  }
  Add-LocalGroupMember -Group "Users" -Member $ChildUser -ErrorAction SilentlyContinue
  Write-Host "  created '$ChildUser' as a Standard user."
}
# Safety: make sure the child is NOT a local Administrator (would bypass everything).
try {
  Remove-LocalGroupMember -Group "Administrators" -Member $ChildUser -ErrorAction Stop
  Write-Warning "  '$ChildUser' was an Administrator — demoted to Standard."
} catch { } # not an admin: expected

# --- 5. install the hardened service (reuses install-service.ps1) ---
Step "Installing hardened agent service"
& (Join-Path $InstallDir "scripts\install-service.ps1") `
    -Server $Server -ChildUser $ChildUser -UpdateBranch $Branch

# --- 6. show the pairing code ---
Step "Pairing"
$log = Join-Path $InstallDir "agent\agent.log"
Write-Host "Waiting for the agent to print a pairing code..."
$code = $null
for ($i = 0; $i -lt 30 -and -not $code; $i++) {
  Start-Sleep -Seconds 2
  if (Test-Path $log) {
    $m = Select-String -Path $log -Pattern "pair.*?(\d{6})" -ErrorAction SilentlyContinue |
         Select-Object -Last 1
    if ($m) { $code = $m.Matches[0].Groups[1].Value }
  }
}
Write-Host ""
if ($code) {
  Write-Host "  PAIRING CODE: $code" -ForegroundColor Green
  Write-Host "  Enter it in the Git1 app (Pair new device)."
} else {
  Write-Host "  No code yet. Tail the log to find it:" -ForegroundColor Yellow
  Write-Host "    Get-Content `"$log`" -Wait"
}

Write-Host "`nAll set. The agent will auto-start at boot and self-update on each push." -ForegroundColor Green
Write-Host "Have the child log in to the '$ChildUser' account to use the PC."
