# Auto-pull from origin and run the Expo dev server with a tunnel so the
# phone can connect from anywhere.
#
# Usage:  .\scripts\dev-watch.ps1
# Stop:   Ctrl+C (the background pull loop is killed automatically)

$ErrorActionPreference = "Stop"
$pullInterval = 5

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "Watching branch: $branch (pull every ${pullInterval}s)"

$pullJob = Start-Job -ScriptBlock {
    param($branch, $interval, $repo)
    Set-Location $repo
    while ($true) {
        try { git pull --quiet origin $branch | Out-Null } catch { Write-Host "[dev-watch] pull failed, retrying" }
        Start-Sleep -Seconds $interval
    }
} -ArgumentList $branch, $pullInterval, (Get-Location).Path

try {
    npx expo start --tunnel
}
finally {
    Stop-Job $pullJob -ErrorAction SilentlyContinue
    Remove-Job $pullJob -ErrorAction SilentlyContinue
}
