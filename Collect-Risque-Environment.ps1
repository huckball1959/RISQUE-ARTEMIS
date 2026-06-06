#Requires -Version 5.1
<#
.SYNOPSIS
  Snapshot RISQUE host environment for KITCHEN vs OLD BEDROOM comparison.

.DESCRIPTION
  Run on each PC from the PORTABLE tree (drive letter may vary):
    powershell -NoProfile -ExecutionPolicy Bypass -File D:\github\RISQUE-UNIFIED\Collect-Risque-Environment.ps1

  Writes snapshots next to this script (e.g. D:\github\RISQUE-UNIFIED\environment-snapshot-*.txt)
#>
$ErrorActionPreference = 'SilentlyContinue'
$labRoot = if ($PSScriptRoot) { $PSScriptRoot } else { 'D:\github\RISQUE-UNIFIED' }
$stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$out = Join-Path $labRoot ("environment-snapshot-{0}-{1}.txt" -f $env:COMPUTERNAME, $stamp)
$lines = New-Object System.Collections.Generic.List[string]

function Add($s) { [void]$lines.Add($s) }

Add '=== RISQUE ENVIRONMENT SNAPSHOT ==='
Add ("Generated: {0}" -f (Get-Date))
Add ("Computer: {0}" -f $env:COMPUTERNAME)
Add ("User: {0}" -f $env:USERNAME)
Add ''

Add '=== OS ==='
$os = Get-CimInstance Win32_OperatingSystem
Add ("Caption: {0}" -f $os.Caption)
Add ("Version: {0} Build {1}" -f $os.Version, $os.BuildNumber)
Add ("Arch: {0}" -f $os.OSArchitecture)
Add ("Last boot: {0}" -f $os.LastBootUpTime)

Add ''
Add '=== CPU ==='
Get-CimInstance Win32_Processor | ForEach-Object {
  Add ("Name: {0}" -f $_.Name)
  Add ("Cores / threads: {0} / {1}" -f $_.NumberOfCores, $_.NumberOfLogicalProcessors)
  Add ("Max MHz: {0}" -f $_.MaxClockSpeed)
}

Add ''
Add '=== RAM ==='
$cs = Get-CimInstance Win32_ComputerSystem
Add ("Total GB: {0:N2}" -f ($cs.TotalPhysicalMemory / 1GB))
Add ("Free GB: {0:N2}" -f ($os.FreePhysicalMemory / 1MB))

Add ''
Add '=== GPU ==='
Get-CimInstance Win32_VideoController | ForEach-Object {
  Add ("GPU: {0} driver {1}" -f $_.Name, $_.DriverVersion)
}

Add ''
Add '=== Storage C: ==='
$ld = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
if ($ld) {
  Add ("Free GB: {0:N2} / {1:N2}" -f ($ld.FreeSpace / 1GB), ($ld.Size / 1GB))
}
Get-PhysicalDisk | ForEach-Object {
  Add ("Physical disk: {0} type={1} sizeGB={2:N0} health={3}" -f $_.FriendlyName, $_.MediaType, ($_.Size / 1GB), $_.HealthStatus)
}

Add ''
Add '=== Power plan ==='
Add (powercfg /getactivescheme 2>&1 | Out-String).Trim()

Add ''
Add '=== Chrome ==='
$chromePaths = @(
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
)
$chromeExe = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($chromeExe) {
  $vi = (Get-Item $chromeExe).VersionInfo
  Add ("Path: {0}" -f $chromeExe)
  Add ("FileVersion: {0}" -f $vi.FileVersion)
} else {
  Add 'Chrome: NOT FOUND'
}

Add ''
Add '=== Edge ==='
$edgePaths = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe"
)
$edgeExe = $edgePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($edgeExe) {
  $vi = (Get-Item $edgeExe).VersionInfo
  Add ("Path: {0}" -f $edgeExe)
  Add ("FileVersion: {0}" -f $vi.FileVersion)
} else {
  Add 'Edge: NOT FOUND'
}

Add ''
Add '=== RISQUE env vars ==='
Add ("RISQUE_DOWNLOAD_PATH = {0}" -f $(if ($env:RISQUE_DOWNLOAD_PATH) { $env:RISQUE_DOWNLOAD_PATH } else { '(not set)' }))
Add ("RISQUE_BROWSER = {0}" -f $(if ($env:RISQUE_BROWSER) { $env:RISQUE_BROWSER } else { '(not set, launcher uses auto)' }))

Add ''
Add '=== Save folders ==='
foreach ($p in @('X:\github\save', 'C:\RISQUE\SAVE', 'C:\risque\save', 'C:\RISQUE\save')) {
  if (Test-Path -LiteralPath $p) {
    $files = Get-ChildItem -LiteralPath $p -File -Recurse -ErrorAction SilentlyContinue
    $sum = ($files | Measure-Object -Property Length -Sum).Sum
    $n = @($files).Count
    Add ("{0}: {1} files, {2:N2} MB total" -f $p, $n, ($sum / 1MB))
    Get-ChildItem -LiteralPath $p -File -ErrorAction SilentlyContinue |
      Sort-Object Length -Descending |
      Select-Object -First 8 |
      ForEach-Object { Add ("  top: {0} ({1:N0} KB)" -f $_.Name, ($_.Length / 1KB)) }
  } else {
    Add ("{0}: (missing)" -f $p)
  }
}

Add ''
Add '=== Loopback disk API (port 5599) ==='
try {
  $tcp = Get-NetTCPConnection -LocalPort 5599 -State Listen -ErrorAction Stop | Select-Object -First 1
  Add ("Port 5599 LISTEN: yes (OwningProcess={0})" -f $tcp.OwningProcess)
} catch {
  Add 'Port 5599 LISTEN: no (launcher disk server not running now)'
}
try {
  $r = Invoke-WebRequest -Uri 'http://127.0.0.1:5599/health' -UseBasicParsing -TimeoutSec 2
  Add ("Health GET: {0}" -f $r.StatusCode)
} catch {
  Add ("Health GET failed: {0}" -f $_.Exception.Message)
}

Add ''
Add '=== UNIFIED + other clones (game.html script fingerprints) ==='
$repos = @(
  'X:\github\RISQUE-APOLLO',
  'C:\github\RISQUE-APOLLO',
  'C:\github\RISQUE-UNIFIED',
  'C:\github\risque',
  'C:\github\RISQUE'
)
foreach ($root in $repos) {
  $gh = Join-Path $root 'game.html'
  if (-not (Test-Path -LiteralPath $gh)) { continue }
  Add ("--- {0} ---" -f $root)
  Add ("  game.html modified: {0}" -f (Get-Item $gh).LastWriteTime)
  $must = @(
    'round-flush-disk-stills-2026-05-18d',
    'skip-turn-checkpoint-battle-stills-2026-05-18d',
    'mirror-debounce-round-flush-2026-05-18d'
  )
  $raw = Get-Content -LiteralPath $gh -Raw
  foreach ($m in $must) {
    Add ("  has {0}: {1}" -f $m, ($raw -match [regex]::Escape($m)))
  }
}

Add ''
Add '=== Launcher paths json ==='
foreach ($lp in @(
  (Join-Path $labRoot 'risque-launcher-paths.json'),
  'X:\github\RISQUE-APOLLO\risque-launcher-paths.json',
  'C:\github\RISQUE-APOLLO\risque-launcher-paths.json',
  'C:\github\risque\risque-launcher-paths.json'
)) {
  if (Test-Path -LiteralPath $lp) {
    Add ("--- {0} ---" -f $lp)
    Add ((Get-Content -LiteralPath $lp -Raw).Trim())
  }
}

Add ''
Add '=== Stills manifest (if present) ==='
foreach ($mf in @('X:\github\save\rqwb-stills-manifest.json', 'C:\RISQUE\SAVE\rqwb-stills-manifest.json', 'C:\risque\save\rqwb-stills-manifest.json')) {
  if (Test-Path -LiteralPath $mf) {
    Add ("Manifest: {0}" -f $mf)
    Add ((Get-Content -LiteralPath $mf -TotalCount 20 | Out-String).Trim())
  }
}

$text = $lines -join "`r`n"
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($out, $text, $utf8)
Write-Host "Wrote: $out"
