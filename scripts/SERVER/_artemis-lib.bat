@echo off
REM ARTEMIS SERVER helpers. Used only from the SERVER folder.
set "ARTEMIS_PORT=5700"
if not defined ARTEMIS_GAME_ROOT (
  if exist "%~dp0artemis-game-path.txt" set /p ARTEMIS_GAME_ROOT=<"%~dp0artemis-game-path.txt"
)
if not defined ARTEMIS_GAME_ROOT set "ARTEMIS_GAME_ROOT=%~dp0..\.."
set "ARTEMIS_GAME_ROOT=%ARTEMIS_GAME_ROOT:"=%"
cd /d "%ARTEMIS_GAME_ROOT%" 2>nul

if /i "%~1"=="killport" goto :killport
if /i "%~1"=="lanip" goto :lanip
if /i "%~1"=="ensurenode" goto :ensurenode
if /i "%~1"=="ensurenpm" goto :ensurenpm
exit /b 1

:killport
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$c = Get-NetTCPConnection -LocalPort %ARTEMIS_PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($c) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Host ('Stopped old server (PID ' + $c.OwningProcess + ')') }"
exit /b 0

:lanip
set "ARTEMIS_LAN_IP="
for /f "usebackq delims=" %%I in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$n = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254*' -and $_.PrefixOrigin -ne 'WellKnown' } | Sort-Object InterfaceMetric | Select-Object -First 1; if ($n) { $n.IPAddress }"`) do set "ARTEMIS_LAN_IP=%%I"
if not defined ARTEMIS_LAN_IP set "ARTEMIS_LAN_IP=192.168.1.44"
exit /b 0

:ensurenode
where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  ERROR: Node.js is not installed or not on PATH.
  echo  Install from https://nodejs.org/ then try again.
  echo.
  exit /b 1
)
if not exist "%ARTEMIS_GAME_ROOT%\artemis-server\server.js" (
  echo.
  echo  ERROR: Game folder not found.
  echo  Edit artemis-game-path.txt in this SERVER folder — one line = full path to RISQUE-ARTEMIS.
  echo  Current path: %ARTEMIS_GAME_ROOT%
  echo.
  exit /b 1
)
exit /b 0

:ensurenpm
if exist "%ARTEMIS_GAME_ROOT%\artemis-server\node_modules\ws\" exit /b 0
echo.
echo  First-time setup: installing server files...
pushd "%ARTEMIS_GAME_ROOT%\artemis-server"
call npm install
set "NPM_EC=%ERRORLEVEL%"
popd
if not "%NPM_EC%"=="0" exit /b 1
exit /b 0
