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
REM  >>> IF THE ROUTER OR HOST IP CHANGES, EDIT ONE LINE BELOW <<<
REM  (the HOST_IP line). Then re-copy this folder to the laptop.
REM ============================================================

set "PORT=5700"
set "DIR=%~dp0"

REM ============================================================
REM  HOST IP — single source of truth. Edit ONLY this line if the
REM  host's address changes (check with ipconfig on the host PC).
REM ============================================================
set "HOST_IP=192.168.68.56"

REM  This folder is always Player 3 (Nooch).
set "JOIN_KEY=p3"

REM  Keep the reference text files in sync (not read for launching).
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
echo    2^) Check the host IP with ipconfig ^(IPv4 Address^) and, if it
echo       changed, edit the HOST_IP line in this file, then re-copy.
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
