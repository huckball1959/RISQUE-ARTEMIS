#Requires -Version 5.1
<#
.SYNOPSIS
  Remove dev-only / duplicate files from RISQUE-UNIFIED root + scripts (portable handoff).

.DESCRIPTION
  Run on the portable drive when it is writable (e.g. from Explorer: right-click Run with PowerShell):
    powershell -NoProfile -ExecutionPolicy Bypass -File D:\github\RISQUE-UNIFIED\Skinny-Portable.ps1

  Keeps: RISQUE.bat, RISQUE.ps1, disk server, chromium launcher, browser-restart job,
         game.html, index.html, replay-machine.html, public-conquest-bridge.html, handoff docs.
#>
$ErrorActionPreference = 'Stop'
$root = if ($PSScriptRoot) { $PSScriptRoot } else { Get-Location }

$removeRoot = @(
  '_patch-toolbar.js', '_reorder-dev-row.js', 'test.bat', 'test-celebration-isolation.html',
  'varify.html', 'Launch RISQUE Dual Display.cmd', 'risque-tv-ping.html', 'CHANGELOG.md', 'DEVLOG.md'
)
$removeScripts = @(
  'skeleton-launch.ps1', 'skeleton-launch.bat', 'RISQUE.bat',
  'risque-mock-round5-player4.json', 'risque-mock-round10-player4.json', 'risque-mock-round15-player4.json',
  'MOCK-GAME-ROUND5.txt', 'MOCK-GAMES-SEQUENTIAL-TEST.txt',
  'risque-mock-round5-loader.html', 'risque-mock-round10-loader.html', 'risque-mock-round15-loader.html',
  'build-mock-round5-player4.mjs', 'build-mock-round-last-player.mjs'
)

foreach ($f in $removeRoot) {
  $p = Join-Path $root $f
  if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Force; Write-Host "Removed $f" }
}
$scripts = Join-Path $root 'scripts'
foreach ($f in $removeScripts) {
  $p = Join-Path $scripts $f
  if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Force; Write-Host "Removed scripts\$f" }
}
$jsTest = Join-Path $root 'js\test-celebration-isolation.js'
if (Test-Path -LiteralPath $jsTest) { Remove-Item -LiteralPath $jsTest -Force; Write-Host 'Removed js\test-celebration-isolation.js' }
$newDir = Join-Path $scripts 'new'
if (Test-Path -LiteralPath $newDir) { Remove-Item -LiteralPath $newDir -Recurse -Force; Write-Host 'Removed scripts\new\' }

Write-Host ''
Write-Host 'Done. scripts folder should contain only:'
Get-ChildItem -LiteralPath $scripts -Name
