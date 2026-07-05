@echo off
setlocal EnableDelayedExpansion
title ARTEMIS
REM ============================================================
REM  CLIENT LAUNCHER — LAPTOP 3 (NOOCH / Player 3)
REM
REM  Connects to the host "traffic cop" (/join/p3); the host then
REM  redirects to whatever test/build is active. Never edit URL
REM  params here — change launchers on the HOST only.
REM
REM  Host IP: read from artemis-host-ip.txt (updated when Guido
REM  runs START-ARTEMIS.bat). Re-copy this folder after START if
REM  the IP ever changes. Fallback default matches Deco reservation.
REM ============================================================

set "PORT=5700"
set "DIR=%~dp0"
set "HOST_IP="

if exist "%DIR%artemis-host-ip.txt" set /p HOST_IP=<"%DIR%artemis-host-ip.txt"
set "HOST_IP=!HOST_IP: =!"

if not defined HOST_IP set "HOST_IP=192.168.68.51"

REM  This folder is always Player 3 (Nooch).
set "JOIN_KEY=p3"

>"%DIR%artemis-host-ip.txt" echo !HOST_IP!
>"%DIR%artemis-seat.txt" echo 3

set "URL=http://!HOST_IP!:!PORT!/join/!JOIN_KEY!"

echo.
echo  ARTEMIS — connecting via host traffic cop...
echo  Host: !HOST_IP!
echo  Seat: !JOIN_KEY!  ^(server picks the active test/build^)
echo  !URL!
echo.
echo  If you see "site can't be reached":
echo    1^) Make sure Guido ran START-ARTEMIS.bat on the host PC
echo    2^) On Guido, re-copy this folder from scripts\LAPTOP 3\
echo       ^(START updates artemis-host-ip.txt automatically^)
echo.
echo  Fullscreen in game: Ctrl+Shift+F   Esc = exit
echo.

if exist "%DIR%_artemis-launch-browser.bat" (
  call "%DIR%_artemis-launch-browser.bat" "!URL!"
) else (
  start "" "!URL!"
)

timeout /t 2 /nobreak >nul
endlocal
