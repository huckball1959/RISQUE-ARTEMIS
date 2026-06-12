@echo off
title ARTEMIS - Player 3
REM Opens host redirect /join/p3

setlocal
set "HOST_IP="
set "PORT=5700"

if exist "%~dp0artemis-host-ip.txt" set /p HOST_IP=<"%~dp0artemis-host-ip.txt"
if not defined HOST_IP set "HOST_IP=192.168.1.44"

set "URL=http://%HOST_IP%:%PORT%/join/p3"

echo.
echo  ARTEMIS Player 3 - opening browser...
echo  Host: %HOST_IP%
echo  %URL%
echo.

if exist "%~dp0_artemis-launch-browser.bat" (
  call "%~dp0_artemis-launch-browser.bat" "%URL%"
) else (
  start "" "%URL%"
)

timeout /t 4 /nobreak >nul
endlocal
