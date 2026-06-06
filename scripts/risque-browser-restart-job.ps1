#Requires -Version 5.1
<#
.SYNOPSIS
  Kill RISQUE-tagged Chromium/Edge windows, then relaunch scripts\RISQUE.bat (local -SkipMenu).
  Invoked by risque-disk-server.ps1 when the game POSTs /api/restart-browser.
#>
param(
    [Parameter(Mandatory = $true)][string]$SaveRoot
)

$ErrorActionPreference = "SilentlyContinue"
$ctxPath = Join-Path $SaveRoot ".risque-launcher-resume-context.json"
if (-not (Test-Path -LiteralPath $ctxPath)) {
    exit 2
}
try {
    $ctx = Get-Content -LiteralPath $ctxPath -Raw -Encoding UTF8 | ConvertFrom-Json
}
catch {
    exit 3
}
$flag = [string]$ctx.instanceFlag
if ([string]::IsNullOrWhiteSpace($flag)) {
    $flag = "--risque-launcher-instance=risque-apollo-local"
}
$delay = 3
try {
    $d = [int]$ctx.delaySec
    if ($d -ge 0 -and $d -le 60) { $delay = $d }
}
catch {
}
Start-Sleep -Seconds $delay

foreach ($procName in @("chrome.exe", "msedge.exe")) {
    try {
        Get-CimInstance -ClassName Win32_Process -Filter "Name='$procName'" |
            Where-Object { $_.CommandLine -and ($_.CommandLine -like "*$flag*") } |
            ForEach-Object {
                Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
            }
    }
    catch {
    }
}

Start-Sleep -Milliseconds 900

$bat = [string]$ctx.batchPath
$wd = [string]$ctx.batchWorkingDirectory
if (-not (Test-Path -LiteralPath $bat)) {
    exit 4
}
$argList = @()
if ($ctx.batchArgs -is [System.Array]) {
    foreach ($a in $ctx.batchArgs) {
        if ($null -ne $a -and "$a".Trim().Length) {
            $argList += [string]$a
        }
    }
}
if ($argList.Count -eq 0) {
    $argList = @("-SkipMenu")
}
try {
    Start-Process -FilePath $bat -ArgumentList $argList -WorkingDirectory $(if ($wd) { $wd } else { (Split-Path -Parent $bat) }) -WindowStyle Normal
}
catch {
    exit 5
}
exit 0
