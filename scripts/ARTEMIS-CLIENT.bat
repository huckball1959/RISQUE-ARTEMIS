@echo off
setlocal EnableDelayedExpansion
title ARTEMIS Client
REM Join an ARTEMIS game from a laptop that is NOT running the server.
REM You can copy THIS file alone to Player 2 / Player 3 laptops (Desktop is fine).

set "ARTEMIS_PORT=5700"
set "ARTEMIS_HOST_IP="
set "ARTEMIS_PLAYER_NAME="

if exist "%~dp0artemis-last-host.txt" (
  set /p ARTEMIS_HOST_IP=<"%~dp0artemis-last-host.txt"
)

echo.
echo  ============================================================
echo   ARTEMIS - JOIN GAME (CLIENT LAPTOP)
echo  ============================================================
echo.
echo  The HOST computer must already have ARTEMIS running ^(option 1^).
echo  Ask the host for their Wi-Fi IP address if you do not know it.
echo  Example IP: 192.168.1.44
echo.

if defined ARTEMIS_HOST_IP (
  echo  Last host IP used: %ARTEMIS_HOST_IP%
  set /p ARTEMIS_HOST_IP=Host IP address [%ARTEMIS_HOST_IP%]: 
) else (
  set /p ARTEMIS_HOST_IP=Host IP address: 
)
if not defined ARTEMIS_HOST_IP (
  echo ERROR: Host IP is required.
  pause
  exit /b 1
)

(echo %ARTEMIS_HOST_IP%)> "%~dp0artemis-last-host.txt"

echo.
set /p ARTEMIS_PLAYER_NAME=Your player name [Player2]: 
if not defined ARTEMIS_PLAYER_NAME set "ARTEMIS_PLAYER_NAME=Player2"

set "CLIENT_URL=http://%ARTEMIS_HOST_IP%:%ARTEMIS_PORT%/game.html?artemis=client&name=%ARTEMIS_PLAYER_NAME%"

echo.
echo  Opening browser...
echo  %CLIENT_URL%
echo.
echo  You should see a blue/green ARTEMIS banner when connected.
echo  The screen will match whatever the HOST is doing.
echo.

start "" "%CLIENT_URL%"

echo  If the page does not load:
echo    - Same Wi-Fi as the host?
echo    - Host ran scripts\ARTEMIS.bat and picked [1] HOST?
echo    - Windows Firewall on host allowed Node.js?
echo.
pause
endlocal
