@echo off
setlocal
title ARTEMIS Server
REM Starts the ARTEMIS HTTP + WebSocket server only. Keep this window open.
REM Most users should run ARTEMIS.bat and pick HOST instead.

cd /d "%~dp0"
set "ARTEMIS_PORT=5700"
set "ARTEMIS_GAME_ROOT=%~dp0.."
cd /d "%ARTEMIS_GAME_ROOT%"

if not exist "artemis-server\server.js" (
  echo ERROR: artemis-server\server.js not found.
  pause
  exit /b 1
)

call "%~dp0_artemis-lib.bat" ensurenode
if errorlevel 1 pause & exit /b 1

call "%~dp0_artemis-lib.bat" ensurenpm
if errorlevel 1 pause & exit /b 1

call "%~dp0_artemis-lib.bat" killport

call "%~dp0_artemis-lib.bat" lanip

echo.
echo  ============================================================
echo   ARTEMIS SERVER - DO NOT CLOSE THIS WINDOW DURING PLAY
echo  ============================================================
echo.
echo   Host browser URL:
echo     http://127.0.0.1:%ARTEMIS_PORT%/game.html?artemis=host
echo.
echo   Other laptops - CLIENT URLs:
echo     http://%ARTEMIS_LAN_IP%:%ARTEMIS_PORT%/game.html?artemis=client^&name=Player2
echo     http://%ARTEMIS_LAN_IP%:%ARTEMIS_PORT%/game.html?artemis=client^&name=Player3
echo.
echo  ============================================================
echo.

node artemis-server\server.js
echo.
echo  Server stopped.
pause
endlocal
