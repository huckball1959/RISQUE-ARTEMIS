@echo off

setlocal EnableDelayedExpansion

title ARTEMIS - START CYCLE PROBE (HOST)

REM Host PC — 18-step cycle probe: 6 phases per player, 3 players (placeholder UI + mirror).



cd /d "%~dp0"



call "%~dp0_artemis-lib.bat" ensurenode

if errorlevel 1 pause & exit /b 1



call "%~dp0_artemis-lib.bat" ensurenpm

if errorlevel 1 pause & exit /b 1



call "%~dp0_artemis-lib.bat" killport

call "%~dp0_artemis-lib.bat" lanip

(echo cycle)> "%ARTEMIS_GAME_ROOT%\launchers\active-mode.txt"



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



set "HOST_URL=http://127.0.0.1:%ARTEMIS_PORT%/join/host-cycle"

echo.

echo  Opening CYCLE PROBE host (via /join/host-cycle)...

start "" "!HOST_URL!"



(echo !ARTEMIS_LAN_IP!)> "%~dp0artemis-host-ip.txt"

if exist "%~dp0..\LAPTOP 2\" (echo !ARTEMIS_LAN_IP!)> "%~dp0..\LAPTOP 2\artemis-host-ip.txt"

if exist "%~dp0..\LAPTOP 3\" (echo !ARTEMIS_LAN_IP!)> "%~dp0..\LAPTOP 3\artemis-host-ip.txt"



cls

echo.

echo  ============================================================

echo   ARTEMIS CYCLE PROBE — HOST RUNNING

echo  ============================================================

echo.

echo   Keep "ARTEMIS Server - DO NOT CLOSE" window open.

echo.

echo   Host IP: !ARTEMIS_LAN_IP!

echo.

echo   Traffic cop mode: CYCLE — clients use ARTEMIS-JOIN.bat only

echo   Join hub: http://!ARTEMIS_LAN_IP!:%ARTEMIS_PORT%/join/

echo.

echo   On laptop 2 / 3: double-click ARTEMIS-JOIN.bat

echo.

echo   After all 3 sign in: host clicks BEGIN 18-STEP PROBE

echo   then NEXT STEP (or AUTO) through 6 phases x 3 players.

echo.

echo   When done, tell Cursor: read logs/artemis-last-report.json

echo.

echo  ============================================================

pause

endlocal

