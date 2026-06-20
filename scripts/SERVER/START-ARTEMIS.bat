@echo off
setlocal EnableDelayedExpansion
title ARTEMIS - START HOST
REM Host PC only. Double-click to start server + open your game.

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

(echo normal)> "%ARTEMIS_GAME_ROOT%\launchers\active-mode.txt"

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
echo   ARTEMIS HOST IS RUNNING
echo  ============================================================
echo.
echo   Keep "ARTEMIS Server - DO NOT CLOSE" window open.
echo.
echo   Fullscreen in game: Ctrl+Shift+F toggle, Esc exit
echo.
echo   Game folder: %ARTEMIS_GAME_ROOT%
echo   ^(from artemis-game-path.txt in this SERVER folder^)
echo.
echo   Host IP: !ARTEMIS_LAN_IP!
echo   ^(saved into LAPTOP 2 and LAPTOP 3 folders automatically^)
echo.
echo   Setup rig: appears on welcome blank after START ^(not on load^)
echo   Login -^> welcome -^> first-card -^> deal -^> setup deploy -^> cardplay ...
echo   Build cache: m255 ^(hard-refresh all laptops after code changes: Ctrl+Shift+R^)
echo   Auto-diagnostics: logs\artemis-last-report.json
echo   TURN PROBE: scripts\SERVER\START-PROBE.bat
echo   CYCLE PROBE: scripts\SERVER\START-CYCLE-PROBE.bat
echo.
echo   Copy to clients ^(whole folder each time IP changes, or once if IP stable^):
echo     scripts\LAPTOP 2  -^>  Mictor desktop  -^>  JOIN.bat
echo     scripts\LAPTOP 3  -^>  Nooch desktop   -^>  JOIN.bat
echo.
echo  ============================================================
pause
endlocal
