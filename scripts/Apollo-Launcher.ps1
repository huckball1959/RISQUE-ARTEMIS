#Requires -Version 5.1
<#
.SYNOPSIS
  RISQUE-APOLLO default launcher — X:\github\ tree only, flat save at X:\github\save.

.DESCRIPTION
  - Verifies repo root is under X:\github\ (portable policy on all lab PCs).
  - Sets RISQUE_DOWNLOAD_PATH to X:\github\save (sibling of RISQUE-APOLLO).
  - Sets RISQUE_LAUNCHER_INSTANCE=risque-apollo-local for Chrome process tagging.
  - Runs Prep-Apollo-Browser.ps1 (wipe risque-host-chrome + risque-browser-profiles).
  - Delegates to scripts\RISQUE.ps1 with -SkipMenu -NoReplayDebug (local file:// only).

.NOTES
  Double-click: scripts\APOLLO-LAUNCHER.bat
#>
param(
    [switch]$SingleWindow,
    [switch]$SkipPrep,
    [switch]$PrepareEnvOnly,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Passthrough
)

$ErrorActionPreference = "Stop"

$ScriptDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent $ScriptDir

try {
    $repoNorm = [System.IO.Path]::GetFullPath($RepoRoot)
}
catch {
    $repoNorm = $RepoRoot
}

if ($repoNorm -notmatch "^[Xx]:\\github\\") {
    Write-Host ""
    Write-Host "ERROR: RISQUE-APOLLO must run from X:\github\<folder>" -ForegroundColor Red
    Write-Host "  Found repo at: $repoNorm"
    Write-Host "  Assign drive X: to your portable github root, then use:"
    Write-Host "    X:\github\RISQUE-APOLLO\scripts\APOLLO-LAUNCHER.bat"
    Write-Host ""
    exit 1
}

$githubRoot = Split-Path -Parent $repoNorm.TrimEnd("\", "/")
$saveRoot = Join-Path $githubRoot "save"

$env:RISQUE_DOWNLOAD_PATH = $saveRoot
$env:RISQUE_LAUNCHER_INSTANCE = "risque-apollo-local"
$env:RISQUE_NO_REPLAY_DEBUG = "1"

$blocked = @($Passthrough | Where-Object {
        $_ -match "^(?i)-Hosted$" -or $_ -match "^(?i)-HostedUrl"
    })
if ($blocked.Count -gt 0) {
    Write-Host "ERROR: APOLLO launcher is local-only (file://). Do not pass -Hosted / -HostedUrl." -ForegroundColor Red
    Write-Host "  Use scripts\RISQUE.bat for hosted GitHub Pages testing."
    exit 1
}

Write-Host ""
Write-Host " RISQUE-APOLLO" -ForegroundColor Cyan
Write-Host "  Repo:  $repoNorm"
Write-Host "  Save:  $saveRoot"
Write-Host ""

if (-not $SkipPrep) {
    $prep = Join-Path $ScriptDir "Prep-Apollo-Browser.ps1"
    if (-not (Test-Path -LiteralPath $prep)) {
        Write-Host "ERROR: Missing $prep" -ForegroundColor Red
        exit 1
    }
    & $prep
    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

$risquePs1 = Join-Path $ScriptDir "RISQUE.ps1"
if (-not (Test-Path -LiteralPath $risquePs1)) {
    Write-Host "ERROR: Missing $risquePs1" -ForegroundColor Red
    exit 1
}

$risqueArgs = @("-SkipMenu", "-NoReplayDebug")
if ($SingleWindow) { $risqueArgs += "-SingleWindow" }
if ($PrepareEnvOnly) { $risqueArgs += "-PrepareEnvOnly" }
if ($Passthrough) { $risqueArgs += $Passthrough }

& $risquePs1 @risqueArgs
exit $LASTEXITCODE
