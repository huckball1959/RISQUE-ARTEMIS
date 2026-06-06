#Requires -Version 5.1
<#
.SYNOPSIS
  Force-stop the RISQUE cursor guard and release Windows ClipCursor.
#>
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $here "risque-chromium-primary.ps1")
Stop-RisqueCursorGuard
Write-Host "Cursor guard stopped; mouse/touch is no longer clipped to the primary display." -ForegroundColor Green
