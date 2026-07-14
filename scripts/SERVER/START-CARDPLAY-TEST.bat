@echo off
setlocal EnableDelayedExpansion
title ARTEMIS - START CARDPLAY TEST
REM Optional mock path (not default). Writes cardplay-test mode then starts like START-ARTEMIS.
REM Host test launcher UI was removed in m346; this batch still boots cards.json via join URL.

cd /d "%~dp0"

call "%~dp0_artemis-lib.bat" ensurenode
if errorlevel 1 pause & exit /b 1

call "%~dp0_artemis-lib.bat" ensurenpm
if errorlevel 1 pause & exit /b 1

call "%~dp0_artemis-lib.bat" killport
call "%~dp0_artemis-lib.bat" lanip

if not exist "%ARTEMIS_GAME_ROOT%\artemis-server\server.js" (
  echo.
  echo  ERROR: Game folder not found.
  echo  Expected: %ARTEMIS_GAME_ROOT%
  echo  Edit artemis-game-path.txt in this SERVER folder.
  pause
  exit /b 1
)

(echo cardplay-test)> "%ARTEMIS_GAME_ROOT%\launchers\active-mode.txt"

echo.
echo  Starting server window ^(CARDPLAY TEST MODE^)...
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

set "HOST_URL=http://127.0.0.1:%ARTEMIS_PORT%/join/host"
echo.
echo  Opening host game in browser...
start "" "!HOST_URL!"

(echo !ARTEMIS_LAN_IP!)> "%~dp0artemis-host-ip.txt"
if exist "%~dp0..\LAPTOP 2\" (echo !ARTEMIS_LAN_IP!)> "%~dp0..\LAPTOP 2\artemis-host-ip.txt"
if exist "%~dp0..\LAPTOP 3\" (echo !ARTEMIS_LAN_IP!)> "%~dp0..\LAPTOP 3\artemis-host-ip.txt"

cls
echo.
echo  ============================================================
echo   ARTEMIS CARDPLAY TEST HOST
echo  ============================================================
echo.
echo   Join URLs use artemisAutoSave=cards ^(round-4 mock^).
echo   For normal play use START-ARTEMIS.bat instead.
echo.
echo   Host IP: !ARTEMIS_LAN_IP!
echo  ============================================================
pause
endlocal
