@echo off
setlocal EnableDelayedExpansion
title ARTEMIS Launcher

cd /d "%~dp0"
set "ARTEMIS_PORT=5700"
set "ARTEMIS_GAME_ROOT=%~dp0.."
cd /d "%ARTEMIS_GAME_ROOT%"

:menu
cls
echo.
echo  ============================================================
echo   ARTEMIS - Network Game Launcher
echo  ============================================================
echo.
echo   Pick ONE option:
echo.
echo     [1]  HOST  - This computer runs the game + server
echo                  ^(use on your NEWEST / most powerful laptop^)
echo.
echo     [2]  CLIENT - Join from another laptop
echo                  ^(server must already be running on the host^)
echo.
echo     [3]  Network test only ^(artemis-test.html^)
echo.
echo     [4]  Stop ARTEMIS server on this PC
echo.
echo     [Q]  Quit
echo.
echo  ============================================================
echo.
set "CHOICE="
set /p CHOICE=Enter 1, 2, 3, 4, or Q: 

if /i "%CHOICE%"=="1" goto :host
if /i "%CHOICE%"=="2" goto :client
if /i "%CHOICE%"=="3" goto :test
if /i "%CHOICE%"=="4" goto :stop
if /i "%CHOICE%"=="Q" exit /b 0
goto :menu

:host
call "%~dp0_artemis-lib.bat" ensurenode
if errorlevel 1 pause & goto :menu

call "%~dp0_artemis-lib.bat" ensurenpm
if errorlevel 1 pause & goto :menu

call "%~dp0_artemis-lib.bat" killport
call "%~dp0_artemis-lib.bat" lanip

echo.
echo  Starting ARTEMIS server in a separate window...
start "ARTEMIS Server - DO NOT CLOSE" /D "%ARTEMIS_GAME_ROOT%" cmd /k call "%~dp0ARTEMIS-HOST.bat"

echo  Waiting for server to start...
set "SERVER_OK=0"
for /L %%N in (1,1,15) do (
  timeout /t 1 /nobreak >nul
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
    "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:%ARTEMIS_PORT%/api/artemis/health' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
  if not errorlevel 1 set "SERVER_OK=1" & goto :server_ready
)
:server_ready
if not "%SERVER_OK%"=="1" (
  echo.
  echo  ERROR: Server did not start on port %ARTEMIS_PORT%.
  echo  Look at the "ARTEMIS Server - DO NOT CLOSE" window for errors.
  echo  Common fixes:
  echo    - Run ARTEMIS.bat again
  echo    - Allow Node.js through Windows Firewall
  echo    - Close anything else using port 5700
  echo.
  pause
  goto :menu
)

set "HOST_URL=http://127.0.0.1:%ARTEMIS_PORT%/game.html?artemis=host"
set "CLIENT2_URL=http://!ARTEMIS_LAN_IP!:%ARTEMIS_PORT%/game.html?artemis=client&name=Player2"
set "CLIENT3_URL=http://!ARTEMIS_LAN_IP!:%ARTEMIS_PORT%/game.html?artemis=client&name=Player3"

echo.
echo  Opening HOST game in your browser...
echo  Fullscreen: Ctrl+Shift+F in-game to toggle ON/OFF. Esc also exits.
if exist "%~dp0_artemis-launch-browser.bat" (
  call "%~dp0_artemis-launch-browser.bat" "!HOST_URL!"
) else (
  start "" "!HOST_URL!"
)

(echo !ARTEMIS_LAN_IP!)> "%~dp0artemis-last-host.txt"
(echo !ARTEMIS_LAN_IP!)> "%~dp0artemis-host-ip.txt"

cls
echo.
echo  ============================================================
echo   ARTEMIS HOST IS RUNNING
echo  ============================================================
echo.
echo   THIS laptop ^(you are playing here too^):
echo     !HOST_URL!
echo.
echo   OTHER laptops - easiest setup:
echo     1. Copy scripts\ARTEMIS-FETCH-FROM-HOST.bat to each client ^(once^)
echo        OR open in browser: http://!ARTEMIS_LAN_IP!:%ARTEMIS_PORT%/artemis-client-setup.html
echo     2. Run FETCH, enter host IP !ARTEMIS_LAN_IP!
echo     3. Double-click ARTEMIS-PLAYER2.bat or ARTEMIS-PLAYER3.bat
echo.
echo   Pre-built player launchers ^(if already copied^):
echo     Player 2:
echo     !CLIENT2_URL!
echo.
echo     Player 3:
echo     !CLIENT3_URL!
echo.
echo   Host IP for clients: !ARTEMIS_LAN_IP!
echo   ^(saved to scripts\artemis-last-host.txt^)
echo.
echo   IMPORTANT:
echo   - Keep the "ARTEMIS Server" window OPEN during play
echo   - Clients must use option [2] or the URLs above
echo   - Do NOT use plain game.html without ?artemis=host or client
echo.
echo  ============================================================
echo.
pause
goto :menu

:client
call "%~dp0ARTEMIS-CLIENT.bat"
goto :menu

:test
call "%~dp0_artemis-lib.bat" ensurenode
if errorlevel 1 pause & goto :menu

call "%~dp0_artemis-lib.bat" ensurenpm
if errorlevel 1 pause & goto :menu

call "%~dp0_artemis-lib.bat" killport

echo.
echo  Starting server for network test...
start "ARTEMIS Server - DO NOT CLOSE" /D "%ARTEMIS_GAME_ROOT%" cmd /k call "%~dp0ARTEMIS-HOST.bat"
timeout /t 3 /nobreak >nul

start "" "http://127.0.0.1:%ARTEMIS_PORT%/artemis-test.html"

echo.
echo  Test page opened on THIS computer.
echo  On other laptops open: http://HOST-IP:%ARTEMIS_PORT%/artemis-test.html
echo.
pause
goto :menu

:stop
call "%~dp0ARTEMIS-STOP.bat"
goto :menu
