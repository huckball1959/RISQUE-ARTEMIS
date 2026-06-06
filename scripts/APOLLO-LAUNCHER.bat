@echo off
setlocal
REM ============================================================================
REM  RISQUE-APOLLO — default portable launcher (X:\github\ only)
REM  Wipes launcher TEMP Chrome profiles, saves to X:\github\save, local file://,
REM  -SkipMenu -NoReplayDebug (lean session). Chrome/Edge via scripts\RISQUE.ps1.
REM
REM  Run from:  X:\github\RISQUE-APOLLO\scripts\APOLLO-LAUNCHER.bat
REM  Repo root:  parent of this scripts folder
REM
REM  Optional args (forwarded to Apollo-Launcher.ps1 / RISQUE.ps1 where applicable):
REM    -SingleWindow       one browser window (no dual-monitor TV flow)
REM    -SkipPrep            do not wipe TEMP profiles before launch
REM    -PrepareEnvOnly      ensure save folder + paths json only; no browser
REM
REM ============================================================================

cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Apollo-Launcher.ps1" %*
set "APOLLO_EC=%ERRORLEVEL%"
if not "%APOLLO_EC%"=="0" (
  echo.
  echo APOLLO launcher exited with error code %APOLLO_EC%.
  echo Repo must live under X:\github\  e.g. X:\github\RISQUE-APOLLO\
  echo Saves go to X:\github\save\
  pause
)
exit /b %APOLLO_EC%
