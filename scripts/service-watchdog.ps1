# Git1 agent watchdog — runs as SYSTEM via a scheduled task (at startup and
# every 5 min). If the Git1Agent service has been deleted or stopped (e.g. a
# savvy admin-child removed it), this re-creates/restarts it. Killing the
# service process is already handled by SCM recovery (failureflag 1); this
# covers full removal of the service itself.
param([string]$ServiceName = "Git1Agent")

$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $svc) {
  # Service was removed — reinstall it.
  $installer = Join-Path $PSScriptRoot "install-service.ps1"
  if (Test-Path $installer) {
    Write-Host "[watchdog] $ServiceName missing — reinstalling"
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installer
  }
  return
}

if ($svc.Status -ne "Running") {
  Write-Host "[watchdog] $ServiceName not running ($($svc.Status)) — starting"
  Start-Service -Name $ServiceName -ErrorAction SilentlyContinue
}
