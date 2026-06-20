<#
  Install-Git1-Kid.ps1 - set up the Git1 agent on a CHILD's Windows PC.

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
  [string]$InstallDir  = "C:\ProgramData\Git1", # outside the kid's profile
  [string]$PythonHome  = "",  # bundled Python dir (the .exe installer sets this); blank -> install/download
  [string]$GitHome     = ""   # bundled Git dir   (the .exe installer sets this); blank -> install/download
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
function Have($cmd) {
  $c = Get-Command $cmd -ErrorAction SilentlyContinue
  if (-not $c) { return $false }
  # Detect Windows "App Execution Alias" stubs (fake python.exe that opens Store).
  if ($cmd -eq "python") {
    try {
      $out = & python --version 2>&1
      if ($LASTEXITCODE -ne 0 -or $out -match "Microsoft Store") { return $false }
    } catch { return $false }
  }
  return $true
}
function Winget-Install($id) {
  if (-not (Have winget)) { return $false }
  Write-Host "  installing $id via winget (source: winget)..."
  # Pipe winget output to host so it doesn't pollute the function's return value.
  winget install --id $id -e --silent --source winget --accept-source-agreements --accept-package-agreements 2>&1 | Out-Host
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "  winget install failed (exit $LASTEXITCODE). Trying direct download fallback..."
    return $false
  }
  return $true
}
function Download-And-Install($url, $installArgs) {
  $tmp = Join-Path $env:TEMP ([IO.Path]::GetFileName($url))
  Write-Host "  downloading $url"
  Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $tmp
  Write-Host "  running installer..."
  Start-Process -FilePath $tmp -ArgumentList $installArgs -Wait
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
}
# Disable Windows "App Execution Alias" stubs that hijack python.exe -> Microsoft Store
$aliasDir = "$env:LOCALAPPDATA\Microsoft\WindowsApps"
foreach ($stub in @("python.exe","python3.exe","python3.12.exe")) {
  $p = Join-Path $aliasDir $stub
  if (Test-Path $p) {
    try { Remove-Item $p -Force -ErrorAction Stop; Write-Host "  removed Store alias: $stub" } catch {}
  }
}
# Resolve latest Git-for-Windows release URL via GitHub API. Falls back to a
# known-good version if the API is unreachable.
function Get-LatestGitUrl {
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $r = Invoke-RestMethod -UseBasicParsing -Uri "https://api.github.com/repos/git-for-windows/git/releases/latest" -TimeoutSec 15
    $asset = $r.assets | Where-Object { $_.name -match '^Git-.*-64-bit\.exe$' } | Select-Object -First 1
    if ($asset) { Write-Host "  latest Git: $($asset.name)"; return $asset.browser_download_url }
  } catch { Write-Host "  github API failed, using fallback Git version" }
  return "https://github.com/git-for-windows/git/releases/download/v2.47.0.windows.1/Git-2.47.0-64-bit.exe"
}

# Resolve latest stable Python 3 by scraping python.org. Falls back to a known-good URL.
function Get-LatestPythonUrl {
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $html = (Invoke-WebRequest -UseBasicParsing -Uri "https://www.python.org/downloads/windows/" -TimeoutSec 15).Content
    # Find first "Latest Python 3 Release - Python 3.X.Y"
    if ($html -match 'Latest Python 3 Release\s*-\s*Python\s*(\d+\.\d+\.\d+)') {
      $ver = $matches[1]
      $url = "https://www.python.org/ftp/python/$ver/python-$ver-amd64.exe"
      Write-Host "  latest Python: $ver"
      return $url
    }
  } catch { Write-Host "  python.org scrape failed, using fallback Python version" }
  return "https://www.python.org/ftp/python/3.12.7/python-3.12.7-amd64.exe"
}

# --- 1b. Prefer runtimes bundled inside the installer payload --------------
# The .exe installer ships a self-contained Python + Git next to this script
# ({app}\python, {app}\git). Using them avoids downloading and silently running
# the python.org / git-for-windows installers at install time — the single
# biggest antivirus/SmartScreen heuristic this installer used to trip. Each is
# verified before use; if anything is missing or unusable we fall straight back
# to the winget/download path below, so the standalone .bat still works and a
# bad bundle can never brick an install.
$usedBundledPython = $false
if (-not $PythonHome) {
  $cand = Join-Path (Split-Path -Parent $PSScriptRoot) 'python'
  if (Test-Path (Join-Path $cand 'python.exe')) { $PythonHome = $cand }
}
if ($PythonHome -and (Test-Path (Join-Path $PythonHome 'python.exe'))) {
  $savedPath = $env:Path
  $env:Path = "$PythonHome;$(Join-Path $PythonHome 'Scripts');$env:Path"
  try {
    $v = & "$PythonHome\python.exe" --version 2>&1
    if ($LASTEXITCODE -ne 0) { throw "python --version exit $LASTEXITCODE" }
    Write-Host "  using bundled Python ($v) at $PythonHome"
    $usedBundledPython = $true
  } catch {
    Write-Warning "  bundled Python unusable ($_); installing Python normally."
    $env:Path = $savedPath
  }
}
if (-not $GitHome) {
  $candG = Join-Path (Split-Path -Parent $PSScriptRoot) 'git'
  if (Test-Path (Join-Path $candG 'cmd\git.exe')) { $GitHome = $candG }
}
if ($GitHome -and (Test-Path (Join-Path $GitHome 'cmd\git.exe'))) {
  $env:Path = "$(Join-Path $GitHome 'cmd');$env:Path"
  Write-Host "  using bundled Git at $GitHome"
}

if (-not (Have python)) {
  # winget Python.Python.3 floats to whatever the current major is.
  if (-not (Winget-Install "Python.Python.3")) {
    if (-not (Winget-Install "Python.Python.3.12")) {
      Download-And-Install (Get-LatestPythonUrl) "/quiet InstallAllUsers=1 PrependPath=1 Include_test=0"
    }
  }
}
if (-not (Have git)) {
  if (-not (Winget-Install "Git.Git")) {
    Download-And-Install (Get-LatestGitUrl) "/VERYSILENT /NORESTART /NOCANCEL /SP- /SUPPRESSMSGBOXES"
  }
}
# refresh PATH for this session so the just-installed tools are visible
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path","User") + ";" +
            "C:\Program Files\Git\cmd;C:\Program Files\Git\bin"
# Re-prepend any bundled runtimes resolved above — the refresh is rebuilt from
# the registry and would otherwise drop them, sending us back to a download.
if ($usedBundledPython) { $env:Path = "$PythonHome;$(Join-Path $PythonHome 'Scripts');$env:Path" }
if ($GitHome -and (Test-Path (Join-Path $GitHome 'cmd\git.exe'))) { $env:Path = "$(Join-Path $GitHome 'cmd');$env:Path" }
if (-not (Have python)) { throw "Python still not found after install - open a new shell and re-run." }
if (-not (Have git))    { throw "Git still not found after install - open a new shell and re-run." }

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

# Shared IPC folder for the SYSTEM service <-> in-session tray "clean lock"
# handshake. Must be writable by BOTH SYSTEM and the standard child user.
$ipcDir = "C:\Users\Public\Git1"
New-Item -ItemType Directory -Force -Path $ipcDir | Out-Null
icacls $ipcDir /grant:r "SYSTEM:(OI)(CI)F" "Users:(OI)(CI)M" | Out-Null

# --- 3. python deps ---
Step "Installing Python dependencies"
python -m pip install --upgrade pip | Out-Null
python -m pip install -r (Join-Path $InstallDir "agent\requirements.txt")

# Safety net: if we're on the bundled interpreter, make sure the native deps
# actually load (pywin32 in particular can misbehave in a stripped-down Python).
# If they don't, fall back to a full system Python install and reinstall deps —
# so a bundling mistake degrades gracefully instead of bricking the agent.
if ($usedBundledPython) {
  & python -c "import win32api, psutil, websockets" 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "  bundled Python can't load native deps; falling back to a full Python install."
    $usedBundledPython = $false
    if (-not (Winget-Install "Python.Python.3")) {
      if (-not (Winget-Install "Python.Python.3.12")) {
        Download-And-Install (Get-LatestPythonUrl) "/quiet InstallAllUsers=1 PrependPath=1 Include_test=0"
      }
    }
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path","User")
    if (-not (Have python)) { throw "Python still not found after fallback install - open a new shell and re-run." }
    python -m pip install --upgrade pip | Out-Null
    python -m pip install -r (Join-Path $InstallDir "agent\requirements.txt")
  }
}

# --- 4. Resolve the child account ---
# Detect the ACTUAL person at the physical console (the screen+keyboard user).
# Never trust %USERNAME% — UAC "Run as administrator" makes that the admin's name,
# not the logged-in user. Always query Windows for the active console session.
function Get-ActiveConsoleUser {
  try {
    # Use quser.exe (built into Windows) — robust against UAC switch.
    $rows = quser 2>$null
    foreach ($r in $rows) {
      # The active session line has '>' in front of the username and STATE='Active'.
      if ($r -match '^\s*>\s*(\S+)\s+\S+\s+\d+\s+Active') { return $matches[1] }
    }
  } catch {}
  # Fallback: WMI ComputerSystem.UserName (interactive logon owner).
  try {
    $u = (Get-CimInstance Win32_ComputerSystem -ErrorAction Stop).UserName
    if ($u) { if ($u.Contains('\')) { return $u.Split('\')[-1] } else { return $u } }
  } catch {}
  return $null
}

$consoleUser = Get-ActiveConsoleUser
if ($consoleUser) {
  Write-Host "  active console user (the person physically using this PC): '$consoleUser'"
  if ($ChildUser -and $ChildUser -ne $consoleUser -and $ChildUser -ne 'auto') {
    Write-Warning "  installer was told to target '$ChildUser', but the actual user is '$consoleUser'."
    Write-Warning "  Overriding -> enforcing on '$consoleUser' so Lock works on the right screen."
  }
  $ChildUser = $consoleUser
} elseif (-not $ChildUser -or $ChildUser -eq 'auto') {
  $ChildUser = $env:USERNAME
  Write-Warning "  could not detect console user; falling back to '$ChildUser'"
}

# Clean up the stale "Kiddo" account from earlier installs (unless that's the
# actual target). It was created back when the installer assumed a separate kid
# account; we now enforce on whoever runs the installer.
if ($ChildUser -ne 'Kiddo') {
  $stale = Get-LocalUser -Name 'Kiddo' -ErrorAction SilentlyContinue
  if ($stale) {
    try {
      Remove-LocalUser -Name 'Kiddo' -ErrorAction Stop
      Write-Host "  removed stale 'Kiddo' account from earlier install."
      # Also remove its profile folder so File Explorer/Login screen don't show it.
      $kiddoProfile = "C:\Users\Kiddo"
      if (Test-Path $kiddoProfile) {
        try { Remove-Item -Recurse -Force $kiddoProfile -ErrorAction Stop } catch {}
      }
    } catch { Write-Warning "  could not remove 'Kiddo' account: $_" }
  }
}

Step "Enforcement target account: '$ChildUser'"
$existing = Get-LocalUser -Name $ChildUser -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "  '$ChildUser' exists. Enforcement will apply to this account."
  # Security check: if the enforced account is an Administrator, the kid can
  # delete the agent, stop the service, and run Recover. Warn LOUDLY. We don't
  # auto-demote (that could lock a parent out of their own admin account).
  $isAdmin = $false
  try {
    $admins = Get-LocalGroupMember -Group "Administrators" -ErrorAction Stop
    foreach ($m in $admins) { if ($m.Name -match "\\$ChildUser$" -or $m.Name -eq $ChildUser) { $isAdmin = $true } }
  } catch {}
  if ($isAdmin) {
    Write-Host ""
    Write-Warning "  *** '$ChildUser' is a LOCAL ADMINISTRATOR. ***"
    Write-Warning "  An admin kid can delete the agent, stop the service, and bypass everything."
    Write-Warning "  For real enforcement, make '$ChildUser' a STANDARD user and use a SEPARATE"
    Write-Warning "  admin account for yourself. To demote now, run in an admin PowerShell:"
    Write-Warning "      Remove-LocalGroupMember -Group Administrators -Member '$ChildUser'"
    Write-Host ""
  } else {
    Write-Host "  '$ChildUser' is a Standard user — good. Files + service are tamper-protected."
  }
} else {
  Write-Host "  '$ChildUser' not found - creating as a Standard user."
  if ($ChildPassword) {
    $sec = ConvertTo-SecureString $ChildPassword -AsPlainText -Force
    New-LocalUser -Name $ChildUser -Password $sec -PasswordNeverExpires -FullName "Git1 Kid" | Out-Null
  } else {
    New-LocalUser -Name $ChildUser -NoPassword -FullName "Git1 Kid" | Out-Null
  }
  Add-LocalGroupMember -Group "Users" -Member $ChildUser -ErrorAction SilentlyContinue
}

# --- 5. install the hardened service (reuses install-service.ps1) ---
Step "Stopping any previous Git1Agent + wiping stale token"

# Kill any leftover state from previous failed installs so no two agents race.
Get-Service Git1Agent -ErrorAction SilentlyContinue | Stop-Service -Force -ErrorAction SilentlyContinue
Get-Process python, pythonw -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -and $_.Path -like "*Git1*" } | Stop-Process -Force -ErrorAction SilentlyContinue

foreach ($cfg in @(
  "C:\Windows\System32\config\systemprofile\AppData\Roaming\Git1\agent.json",
  "C:\Windows\System32\config\systemprofile\AppData\Roaming\Git1\config.json",
  (Join-Path $env:APPDATA "Git1\agent.json"),
  (Join-Path $env:APPDATA "Git1\config.json")
)) {
  if (Test-Path $cfg) {
    try { Remove-Item $cfg -Force -ErrorAction Stop; Write-Host "  cleared $cfg" } catch {}
  }
}

# --- 6. PAIR BEFORE installing the service. Otherwise the service-started agent
#     and the installer would each generate a pair code and race against your
#     dashboard click. By owning the pair flow here, only ONE code is active.
Step "Pairing (get code from server, wait for you to claim it in the dashboard)"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$code = $null; $agentToken = $null; $deviceId = $null
try {
  Write-Host "  requesting pair code from $Server ..."
  $r = Invoke-RestMethod -UseBasicParsing -Method Post -Uri "$Server/agent/pair/start" -TimeoutSec 30
  $code = $r.code
  Write-Host ""
  Write-Host ("  >>> PAIRING CODE: " + $code + " <<<") -ForegroundColor Green
  Write-Host ("  Open " + $Server + " on your phone/PC -> sign in -> enter this code -> Pair") -ForegroundColor Cyan
  Write-Host ""
  Write-Host "  Waiting up to 5 minutes for you to claim it..." -ForegroundColor Cyan
  for ($i = 0; $i -lt 150 -and -not $agentToken; $i++) {
    Start-Sleep -Seconds 2
    try {
      $p = Invoke-RestMethod -UseBasicParsing -Method Get -Uri ($Server + "/agent/pair/poll?code=" + $code) -TimeoutSec 10
      if ($p.status -eq 'paired') {
        $agentToken = $p.agentToken
        $deviceId = $p.deviceId
        Write-Host "  PAIRED! token signed=$(if ($agentToken -match '\.') { 'yes' } else { 'no' })" -ForegroundColor Green
        break
      }
    } catch {}
  }
} catch {
  Write-Warning "  could not reach server to get pair code: $($_.Exception.Message)"
}

if (-not $agentToken) {
  throw "Pairing did not complete. Re-run the installer when you're ready to claim the code in the dashboard."
}

# Write token to disk in UTF-8 WITHOUT BOM (Python json.load chokes on BOM).
$systemCfgDir = "C:\Windows\System32\config\systemprofile\AppData\Roaming\Git1"
New-Item -ItemType Directory -Force -Path $systemCfgDir | Out-Null
$cfgPath = Join-Path $systemCfgDir "agent.json"
$cfgJson = (@{ agentToken = $agentToken; deviceId = $deviceId; server = $Server } | ConvertTo-Json -Compress)
[IO.File]::WriteAllText($cfgPath, $cfgJson, (New-Object Text.UTF8Encoding $false))
Write-Host "  wrote $cfgPath (UTF-8 no BOM)"

# --- 7. NOW install the service. Agent starts with the token already on disk,
#     skips its own pair flow, connects immediately, dashboard goes online.
Step "Installing hardened agent service"
& (Join-Path $InstallDir "scripts\install-service.ps1") `
    -Server $Server -ChildUser $ChildUser -UpdateBranch $Branch

# Wait for the agent to actually connect, so we can report success clearly.
Step "Verifying agent is online"
$log = Join-Path $InstallDir "agent\agent.log"
$connected = $false
for ($i = 0; $i -lt 20 -and -not $connected; $i++) {
  Start-Sleep -Seconds 2
  if (Test-Path $log) {
    $tail = Get-Content $log -Tail 10 -ErrorAction SilentlyContinue
    if ($tail -match '\[ws\] connected') { $connected = $true; break }
    if ($tail -match 'unauthorized|4401') {
      Write-Warning "  Server rejected the token. Run the installer again after waiting 60s for the server deploy to land."
      break
    }
  }
}
if ($connected) {
  Write-Host "  AGENT ONLINE. Dashboard should show this device as green within 5s." -ForegroundColor Green
} else {
  Write-Warning "  Agent did not report [ws] connected within 40s. Check $log."
}

# --- 5b. kid-facing app: tray icon + shortcuts + autorun at kid login ---
Step "Setting up the kid's 'Git1 - My time' app"
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

function New-Shortcut($path, $target, $shortcutArgs, $description) {
  $sc = $wsh.CreateShortcut($path)
  $sc.TargetPath = $target
  $sc.Arguments  = $shortcutArgs
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

Write-Host "`nAll set. The agent will auto-start at boot and self-update on each push." -ForegroundColor Green
Write-Host "Have the child log in to the '$ChildUser' account to use the PC."

# --- safety net: put the emergency off-switch + re-pair tool on the desktop ---
Step "Lockout safety"
$recoverSrc = Join-Path $InstallDir "scripts\Recover-Git1.bat"
$repairSrc  = Join-Path $InstallDir "scripts\Repair-Pair-Git1.bat"
try {
  Copy-Item $recoverSrc "C:\Users\Public\Desktop\Recover-Git1.bat" -Force
  Write-Host "  Placed 'Recover-Git1.bat' on the desktop (emergency off switch)."
} catch { Write-Host "  Recovery script lives at: $recoverSrc" }
try {
  Copy-Item $repairSrc "C:\Users\Public\Desktop\Repair-Pair-Git1.bat" -Force
  Write-Host "  Placed 'Repair-Pair-Git1.bat' on the desktop (parent recovery code -> re-pair)."
} catch { Write-Host "  Re-pair script lives at: $repairSrc" }

Write-Host ""
Write-Host "IMPORTANT - you can ALWAYS undo this:" -ForegroundColor Yellow
Write-Host "  * Enforcement only affects the '$ChildUser' account. Your OWN admin"
Write-Host "    account is never locked and keeps internet - log into it to fix things."
Write-Host "  * Run 'Recover-Git1.bat' (desktop) to fully disarm, even with no server."
Write-Host "  * Worst case, boot into SAFE MODE then run Recover-Git1.bat."
Write-Host "  >> Make sure your admin account has a PASSWORD YOU REMEMBER before you"
Write-Host "     leave this PC with the child. That's your guaranteed way back in."
Write-Host ""
Write-Host "RECOMMENDED FIRST: run a safe trial before trusting it -" -ForegroundColor Cyan
Write-Host "  Test-Git1.bat    (arms a guaranteed auto-disarm after 10 min, so you"
Write-Host "                    can test lock/internet/recover with zero risk)."
