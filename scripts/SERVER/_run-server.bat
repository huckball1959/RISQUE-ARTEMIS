@echo off
title ARTEMIS Server
REM Internal — keep window open. Use START-ARTEMIS.bat on the host PC.

cd /d "%~dp0"
call "%~dp0_artemis-lib.bat" ensurenode
if errorlevel 1 pause & exit /b 1
call "%~dp0_artemis-lib.bat" ensurenpm
if errorlevel 1 pause & exit /b 1
call "%~dp0_artemis-lib.bat" killport
call "%~dp0_artemis-lib.bat" lanip

cd /d "%ARTEMIS_GAME_ROOT%"

echo.
echo  ============================================================
echo   ARTEMIS SERVER - DO NOT CLOSE THIS WINDOW DURING PLAY
echo  ============================================================
echo.
echo   Serving: %ARTEMIS_GAME_ROOT%
echo.
echo   Host:  http://127.0.0.1:%ARTEMIS_PORT%/game.html?artemis=host&slot=1
echo   LAN:   http://%ARTEMIS_LAN_IP%:%ARTEMIS_PORT%/
echo.

node artemis-server\server.js
echo.
echo  Server stopped.
pause
