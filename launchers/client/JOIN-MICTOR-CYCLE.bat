@echo off
title ARTEMIS - Mictor Cycle Probe
REM Permanent stub — opens host redirect /join/p2-cycle

setlocal
set "PORT=5700"
set "HOST_IP="

if exist "%~dp0artemis-host-ip.txt" set /p HOST_IP=<"%~dp0artemis-host-ip.txt"
set "HOST_IP=%HOST_IP: =%"
if not defined HOST_IP set "HOST_IP=192.168.1.44"

set "URL=http://%HOST_IP%:%PORT%/join/p2-cycle"

echo.
echo  ARTEMIS Cycle Probe — Mictor...
echo  %URL%
echo.

if exist "%~dp0_artemis-launch-browser.bat" (
  call "%~dp0_artemis-launch-browser.bat" "%URL%"
) else (
  start "" "%URL%"
)

timeout /t 3 /nobreak >nul
endlocal
