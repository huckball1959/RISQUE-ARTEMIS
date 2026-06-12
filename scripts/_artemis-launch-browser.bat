@echo off
REM Usage: call _artemis-launch-browser.bat "http://..."
REM Opens a normal browser window (NOT forced fullscreen — use Ctrl+Shift+F in-game to toggle).
if "%~1"=="" exit /b 1
set "URL=%~1"

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%URL%"
  exit /b 0
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%URL%"
  exit /b 0
)
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "%URL%"
  exit /b 0
)
if exist "%LocalAppData%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%LocalAppData%\Microsoft\Edge\Application\msedge.exe" "%URL%"
  exit /b 0
)

start "" "%URL%"
exit /b 0
