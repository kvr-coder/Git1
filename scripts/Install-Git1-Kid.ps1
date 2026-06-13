<#
  Install-Git1-Kid.ps1 — set up the Git1 agent on a CHILD's Windows PC.

  Run once (the .bat wrapper self-elevates to Administrator). From zero it:
    1. ensures Python 3 + Git are installed (via winget if missing)
    2. clones the repo to a protected location the kid can't edit
    3. installs the agent's Python dependencies
    4. lets you pick an EXISTING standard account to manage, or create a new one
       (defaults to managing an account that already exists — it will NOT
        silently create a second "Git1 Kid" account)
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
  # Account to manage. Leave blank to get an interactive picker that lists the
  # PC's existing standard accounts (the safe default). Pass a name to manage it
  # directly; if no such account exists you'll be asked before one is created.
  [string]$ChildUser   = "",
  [string]$ChildPassword = "",                 # blank = passwordless kid login
  [string]$Branch      = "claude/setup-git1-dev-environment-QeNdU",
  [string]$RepoUrl     = "https://github.com/kvr-coder/git1.git",
  [string]$InstallDir  = "C:\ProgramData\Git1" # outside the kid's profile
)

$ErrorActionPreference = "Stop"
function Step($m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }

# Local accounts that are real, enabled, and NOT administrators — i.e. the ones
# you'd actually want to manage as "the kid". Excludes built-in/system accounts.
function Get-LocalNonAdminUsers {
  $adminMembers = @()
  try {
    $adminMembers = @(Get-LocalGroupMember -Group "Administrators" -ErrorAction Stop |
                      ForEach-Object { ($_.Name -split '\\')[-1] })
  } catch {}
  $builtin = @('Administrator','DefaultAccount','Guest','WDAGUtilityAccount')
  Get-LocalUser -ErrorAction SilentlyContinue | Where-Object {
    $_.Enabled -and
    ($builtin -notcontains $_.Name) -and
    ($adminMembers -notcontains $_.Name)
  }
}

# Decide which account Git1 will manage. Defaults to MANAGE EXISTING: lists the
# non-admin accounts already on the PC and lets the parent choose, so re-running
# the installer never quietly spawns a duplicate child account. Returns a
# hashtable @{ Name = <string>; Create = <bool> }.
function Select-ChildAccount {
  param([string]$Preset)

  # Non-interactive path: a name was passed on the command line.
  if ($Preset) {
    if (Get-LocalUser -Name $Preset -ErrorAction SilentlyContinue) {
      return @{ Name = $Preset; Create = $false }
    }
    Write-Warning "No local account named '$Preset' exists on this PC."
    $yn = Read-Host "Create a NEW standard account '$Preset'? (y/N)"
    if ($yn -match '^[Yy]') { return @{ Name = $Preset; Create = $true } }
    throw "No account selected. Re-run with -ChildUser <existing account>, or pick from the list (run with no -ChildUser)."
  }

  $candidates = @(Get-LocalNonAdminUsers)
  Write-Host ""
  Write-Host "Which account should Git1 manage as the child?" -ForegroundColor Cyan
  if ($candidates.Count -gt 0) {
    Write-Host "Existing standard (non-admin) accounts on this PC:"
    for ($i = 0; $i -lt $candidates.Count; $i++) {
      $full = if ($candidates[$i].FullName) { " ($($candidates[$i].FullName))" } else { "" }
      Write-Host ("  [{0}] {1}{2}" -f ($i + 1), $candidates[$i].Name, $full)
    }
  } else {
    Write-Host "  (no existing standard accounts found on this PC)"
  }
  Write-Host "  [N] Create a NEW standard account for the child"
  Write-Host ""

  while ($true) {
    $choice = Read-Host "Choose a number to MANAGE THAT EXISTING account, or N to create new"
    if ($choice -match '^[Nn]$') {
      $name = (Read-Host "  New account name (e.g. the child's first name)").Trim()
      if ($name) { return @{ Name = $name; Create = $true } }
      Write-Host "  name can't be empty." -ForegroundColor Yellow
      continue
    }
    $n = 0
    if ([int]::TryParse($choice, [ref]$n) -and $n -ge 1 -and $n -le $candidates.Count) {
      return @{ Name = $candidates[$n - 1].Name; Create = $false }
    }
    Write-Host "  invalid choice — enter a listed number or N." -ForegroundColor Yellow
  }
}

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

# --- 4. choose (or create) the child account ---
Step "Selecting the child account"
$sel       = Select-ChildAccount -Preset $ChildUser
$ChildUser = $sel.Name

if (-not $sel.Create) {
  Write-Host "  Managing EXISTING account '$ChildUser' — no new account created." -ForegroundColor Green
} else {
  Write-Host "  Creating new standard account '$ChildUser'..."
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

# --- 5b. kid-facing app: tray icon + shortcuts + autorun at kid login ---
Step "Setting up the kid's 'Git1 — My time' app"
$python    = (Get-Command python -ErrorAction SilentlyContinue).Source
$pythonw   = if ($python) { Join-Path (Split-Path $python) "pythonw.exe" } else { "" }
if (-not (Test-Path $pythonw)) { $pythonw = $python }   # fallback
$trayPy    = Join-Path $InstallDir "agent\tray.py"
$wsh       = New-Object -ComObject WScript.Shell

# Resolve the child's profile path (handles non-default Users locations).
$childProfile = $null
try {
  $childSidObj = (New-Object System.Security.Principal.NTAccount($ChildUser)
                ).Translate([System.Security.Principal.SecurityIdentifier]).Value
  $profKey = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList\$childSidObj"
  if (Test-Path $profKey) { $childProfile = (Get-ItemProperty $profKey).ProfileImagePath }
} catch {}
if (-not $childProfile) { $childProfile = "C:\Users\$ChildUser" }

# Make the profile shell folders if Windows hasn't initialised them yet.
$childDesktop = Join-Path $childProfile "Desktop"
$childStartup = Join-Path $childProfile "AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup"
$childStart   = Join-Path $childProfile "AppData\Roaming\Microsoft\Windows\Start Menu\Programs"
foreach ($d in @($childDesktop, $childStartup, $childStart)) {
  New-Item -ItemType Directory -Force -Path $d | Out-Null
}

function New-Shortcut($path, $target, $args, $description) {
  $sc = $wsh.CreateShortcut($path)
  $sc.TargetPath = $target
  $sc.Arguments  = $args
  $sc.Description = $description
  $sc.WorkingDirectory = (Split-Path $target -Parent)
  $sc.IconLocation = "$target,0"
  $sc.Save()
}

# Desktop + Start Menu shortcut: opens dashboard in default browser.
$dashUrl = "http://127.0.0.1:17654"
$ieExplore = "$env:SystemRoot\explorer.exe"
New-Shortcut (Join-Path $childDesktop "Git1 - My time.lnk") $ieExplore $dashUrl "Your Git1 time dashboard"
New-Shortcut (Join-Path $childStart   "Git1 - My time.lnk") $ieExplore $dashUrl "Your Git1 time dashboard"

# Startup items: tray icon + subtle desktop overlay, both at the kid's logon.
$overlayPy = Join-Path $InstallDir "agent\overlay.py"
New-Shortcut (Join-Path $childStartup "Git1 Tray.lnk")    $pythonw "`"$trayPy`""    "Git1 tray icon"
New-Shortcut (Join-Path $childStartup "Git1 Overlay.lnk") $pythonw "`"$overlayPy`"" "Git1 time-left overlay"

Write-Host "  Desktop + Start Menu shortcut: 'Git1 - My time' (opens dashboard)."
Write-Host "  Tray icon + corner overlay start automatically when '$ChildUser' logs in."

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

# --- safety net: put the emergency off-switch on the desktop ---
Step "Lockout safety"
$recoverSrc = Join-Path $InstallDir "scripts\Recover-Git1.bat"
try {
  Copy-Item $recoverSrc "C:\Users\Public\Desktop\Recover-Git1.bat" -Force
  Write-Host "  Placed 'Recover-Git1.bat' on the desktop (emergency off switch)."
} catch { Write-Host "  Recovery script lives at: $recoverSrc" }

Write-Host ""
Write-Host "IMPORTANT — you can ALWAYS undo this:" -ForegroundColor Yellow
Write-Host "  * Enforcement only affects the '$ChildUser' account. Your OWN admin"
Write-Host "    account is never locked and keeps internet — log into it to fix things."
Write-Host "  * Run 'Recover-Git1.bat' (desktop) to fully disarm, even with no server."
Write-Host "  * Worst case, boot into SAFE MODE then run Recover-Git1.bat."
Write-Host "  >> Make sure your admin account has a PASSWORD YOU REMEMBER before you"
Write-Host "     leave this PC with the child. That's your guaranteed way back in."
Write-Host ""
Write-Host "RECOMMENDED FIRST: run a safe trial before trusting it -" -ForegroundColor Cyan
Write-Host "  Test-Git1.bat    (arms a guaranteed auto-disarm after 10 min, so you"
Write-Host "                    can test lock/internet/recover with zero risk)."
