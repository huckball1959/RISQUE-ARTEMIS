@echo off
setlocal
REM RISQUE-APOLLO — no menu; local file:// + X:\github\save (see scripts\APOLLO-LAUNCHER.bat).
cd /d "%~dp0"
call "%~dp0scripts\APOLLO-LAUNCHER.bat" %*
exit /b %ERRORLEVEL%
