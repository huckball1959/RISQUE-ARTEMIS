@echo off
REM Shared helpers for ARTEMIS launchers. Called with: call "%~dp0_artemis-lib.bat" <command>
REM NOTE: no setlocal here — callers must receive ARTEMIS_GAME_ROOT, ARTEMIS_PORT, ARTEMIS_LAN_IP.
set "ARTEMIS_PORT=5700"
if not defined ARTEMIS_GAME_ROOT set "ARTEMIS_GAME_ROOT=%~dp0.."
cd /d "%ARTEMIS_GAME_ROOT%" 2>nul

if /i "%~1"=="init" goto :init
if /i "%~1"=="killport" goto :killport
if /i "%~1"=="lanip" goto :lanip
if /i "%~1"=="ensurenode" goto :ensurenode
if /i "%~1"=="ensurenpm" goto :ensurenpm
exit /b 1

:init
set "ARTEMIS_PORT=5700"
set "ARTEMIS_GAME_ROOT=%~dp0.."
exit /b 0

:killport
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$c = Get-NetTCPConnection -LocalPort %ARTEMIS_PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($c) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Host ('Stopped old server (PID ' + $c.OwningProcess + ')') }"
exit /b 0

:lanip
set "ARTEMIS_LAN_IP="
for /f "usebackq delims=" %%I in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$n = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254*' -and $_.PrefixOrigin -ne 'WellKnown' } | Sort-Object InterfaceMetric | Select-Object -First 1; if ($n) { $n.IPAddress }"`) do set "ARTEMIS_LAN_IP=%%I"
if not defined ARTEMIS_LAN_IP set "ARTEMIS_LAN_IP=YOUR-LAN-IP"
exit /b 0

:ensurenode
where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  ERROR: Node.js is not installed or not on PATH.
  echo  Install Node.js LTS from https://nodejs.org/
  echo  Then close this window, open a new one, and run ARTEMIS again.
  echo.
  exit /b 1
)
exit /b 0

:ensurenpm
if exist "%ARTEMIS_GAME_ROOT%\artemis-server\node_modules\ws\" exit /b 0
echo.
echo  First-time setup: installing ARTEMIS server files...
pushd "%ARTEMIS_GAME_ROOT%\artemis-server"
call npm install
set "NPM_EC=%ERRORLEVEL%"
popd
if not "%NPM_EC%"=="0" exit /b 1
exit /b 0
