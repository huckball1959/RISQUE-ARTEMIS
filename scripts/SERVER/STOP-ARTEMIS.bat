@echo off
title ARTEMIS - STOP SERVER
cd /d "%~dp0"
call "%~dp0_artemis-lib.bat" killport
echo.
echo  ARTEMIS server stopped ^(port 5700^).
echo.
pause
