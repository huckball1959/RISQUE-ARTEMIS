@echo off
setlocal EnableDelayedExpansion
title ARTEMIS
REM ============================================================
REM  THE ONLY CLIENT LAUNCHER YOU NEED TO COPY TO A LAPTOP
REM
REM  1) Connects to the host "traffic cop" (/join/p2 or /join/p3)
REM  2) Host redirects to whatever test is active (normal, cycle, etc.)
REM  3) Never edit URL params here — change launchers on the HOST only
REM
REM  First run asks: host IP (once) and seat 2 or 3 (once).
REM  Saves artemis-host-ip.txt and artemis-seat.txt beside this file.
REM ============================================================

set "PORT=5700"
set "DIR=%~dp0"
set "HOST_IP="
set "SEAT="
set "JOIN_KEY="

if exist "%DIR%artemis-host-ip.txt" (
  set /p HOST_IP=<"%DIR%artemis-host-ip.txt"
)
set "HOST_IP=!HOST_IP: =!"

if not defined HOST_IP (
  echo.
  echo  ARTEMIS — first-time setup
  echo  Host must be running START-ARTEMIS.bat ^(or cycle/probe^) first.
  echo.
  set /p HOST_IP=Enter host IP address ^(e.g. 192.168.1.44^): 
  if not defined HOST_IP (
    echo ERROR: Host IP required.
    pause
    exit /b 1
  )
  set "HOST_IP=!HOST_IP: =!"
  echo !HOST_IP!> "%DIR%artemis-host-ip.txt"
)

if exist "%DIR%artemis-seat.txt" (
  set /p SEAT=<"%DIR%artemis-seat.txt"
)
set "SEAT=!SEAT: =!"

if /I "!SEAT!"=="2" set "JOIN_KEY=p2"
if /I "!SEAT!"=="3" set "JOIN_KEY=p3"
if /I "!SEAT!"=="mictor" set "JOIN_KEY=p2"
if /I "!SEAT!"=="nooch" set "JOIN_KEY=p3"
if /I "!SEAT!"=="p2" set "JOIN_KEY=p2"
if /I "!SEAT!"=="p3" set "JOIN_KEY=p3"

if not defined JOIN_KEY (
  echo.
  echo  Which player is this laptop?
  echo    2 = Mictor  ^(Player 2^)
  echo    3 = Nooch   ^(Player 3^)
  echo.
  set /p SEAT=Enter 2 or 3: 
  if /I "!SEAT!"=="2" set "JOIN_KEY=p2"
  if /I "!SEAT!"=="3" set "JOIN_KEY=p3"
  if not defined JOIN_KEY (
    echo ERROR: Enter 2 or 3 only.
    pause
    exit /b 1
  )
  echo !SEAT!> "%DIR%artemis-seat.txt"
)

set "URL=http://!HOST_IP!:!PORT!/join/!JOIN_KEY!"

echo.
echo  ARTEMIS — connecting via host traffic cop...
echo  Host: !HOST_IP!
echo  Seat: !JOIN_KEY!  ^(server picks the active test/build^)
echo  !URL!
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
