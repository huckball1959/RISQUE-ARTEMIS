@echo off
setlocal
title ARTEMIS Stop Server
cd /d "%~dp0"
call "%~dp0_artemis-lib.bat" init

echo.
echo  Stopping ARTEMIS server on port %ARTEMIS_PORT%...
call "%~dp0_artemis-lib.bat" killport
echo  Done.
echo.
pause
endlocal
