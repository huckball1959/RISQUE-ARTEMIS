@echo off
setlocal EnableDelayedExpansion
title ARTEMIS - START TURN PROBE (HOST)
REM Host PC — starts server + opens the standalone turn probe harness.

cd /d "%~dp0"

call "%~dp0_artemis-lib.bat" ensurenode
if errorlevel 1 pause & exit /b 1

call "%~dp0_artemis-lib.bat" ensurenpm
if errorlevel 1 pause & exit /b 1

call "%~dp0_artemis-lib.bat" killport
call "%~dp0_artemis-lib.bat" lanip

(echo turn-probe)> "%ARTEMIS_GAME_ROOT%\launchers\active-mode.txt"

echo.
echo  Starting server window...
start "ARTEMIS Server - DO NOT CLOSE" /D "%ARTEMIS_GAME_ROOT%" cmd /k call "%~dp0_run-server.bat"

echo  Waiting for server...
set "SERVER_OK=0"
for /L %%N in (1,1,15) do (
  timeout /t 1 /nobreak >nul
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
    "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:%ARTEMIS_PORT%/api/artemis/health' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
  if not errorlevel 1 set "SERVER_OK=1" & goto :ready
)
:ready
if not "%SERVER_OK%"=="1" (
  echo.
  echo  ERROR: Server did not start. Check the server window for errors.
  pause
  exit /b 1
)

set "HOST_URL=http://127.0.0.1:%ARTEMIS_PORT%/artemis-probe/probe.html?artemis=host&slot=1"
echo.
echo  Opening TURN PROBE on host...
start "" "!HOST_URL!"

(echo !ARTEMIS_LAN_IP!)> "%~dp0artemis-host-ip.txt"
if exist "%~dp0..\LAPTOP 2\" (echo !ARTEMIS_LAN_IP!)> "%~dp0..\LAPTOP 2\artemis-host-ip.txt"
if exist "%~dp0..\LAPTOP 3\" (echo !ARTEMIS_LAN_IP!)> "%~dp0..\LAPTOP 3\artemis-host-ip.txt"

cls
echo.
echo  ============================================================
echo   ARTEMIS TURN PROBE — HOST RUNNING
echo  ============================================================
echo.
echo   Keep "ARTEMIS Server - DO NOT CLOSE" window open.
echo.
echo   Host IP: !ARTEMIS_LAN_IP!
echo   ^(saved into LAPTOP 2 and LAPTOP 3 folders^)
echo.
echo   On each client laptop run JOIN-PROBE.bat from:
echo     scripts\LAPTOP 2
echo     scripts\LAPTOP 3
echo.
echo  ============================================================
pause
endlocal
