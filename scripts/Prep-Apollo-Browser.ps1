#Requires -Version 5.1
<#
.SYNOPSIS
  RISQUE-APOLLO: close launcher Chrome windows and wipe TEMP game profiles.

.DESCRIPTION
  Clears only game launcher profiles (not your daily Chrome Settings profile):
    %TEMP%\risque-host-chrome
    %TEMP%\risque-browser-profiles

  Stops Chrome tagged with risque-apollo-local (default Apollo launch) or risque-apollo-menu (menu-driven scripts\RISQUE.bat launch).
#>
$ErrorActionPreference = "SilentlyContinue"

function Stop-RisqueLauncherChromeByFlag {
    param([string]$InstanceId)
    $flag = "--risque-launcher-instance=$InstanceId"
    Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
        Where-Object { $_.CommandLine -and $_.CommandLine -like "*$flag*" } |
        ForEach-Object {
            Write-Host "Stopping Chrome PID $($_.ProcessId) ($InstanceId)"
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
}

$dirs = @(
    Join-Path $env:TEMP "risque-host-chrome"
    Join-Path $env:TEMP "risque-browser-profiles"
)

Write-Host "RISQUE-APOLLO browser prep..." -ForegroundColor Cyan
$chromiumPs1 = Join-Path $PSScriptRoot "risque-chromium-primary.ps1"
if (Test-Path -LiteralPath $chromiumPs1) {
    . $chromiumPs1
    Stop-RisqueCursorGuard
}
foreach ($id in @("risque-apollo-local", "risque-apollo-menu")) {
    Stop-RisqueLauncherChromeByFlag -InstanceId $id
}
Start-Sleep -Seconds 2

foreach ($d in $dirs) {
    if (Test-Path -LiteralPath $d) {
        $mb = [math]::Round(
            (Get-ChildItem -LiteralPath $d -Recurse -Force |
                Measure-Object -Property Length -Sum).Sum / 1MB, 2)
        Write-Host "Removing $d (${mb} MB)" -ForegroundColor Yellow
        Remove-Item -LiteralPath $d -Recurse -Force
    }
    $gone = -not (Test-Path -LiteralPath $d)
    Write-Host ("  {0} -> {1}" -f $d, $(if ($gone) { "cleared" } else { "STILL PRESENT (close Chrome and retry)" }))
}

Write-Host ""
Write-Host "Next: X:\github\RISQUE-APOLLO\scripts\APOLLO-LAUNCHER.bat" -ForegroundColor Green
Write-Host "  Autosave tier: battle_stills (5) at login on lab PCs."
Write-Host ""
