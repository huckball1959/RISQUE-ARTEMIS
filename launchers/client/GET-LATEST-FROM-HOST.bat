@echo off

setlocal EnableDelayedExpansion

title ARTEMIS - Get client launcher from HOST

REM One-time: pull ARTEMIS-JOIN.bat from host. After that, only double-click ARTEMIS-JOIN.bat.



set "PORT=5700"

set "HOST_IP="

set "DEST=%USERPROFILE%\Desktop\ARTEMIS"



if exist "%~dp0artemis-host-ip.txt" set /p HOST_IP=<"%~dp0artemis-host-ip.txt"



echo.

echo  ============================================================

echo   ARTEMIS - Download THE client launcher from HOST

echo  ============================================================

echo.

echo  The HOST must be running ^(START-ARTEMIS.bat^).

echo.



if defined HOST_IP (

  echo  Last host IP: %HOST_IP%

  set /p HOST_IP=Host IP address [%HOST_IP%]: 

) else (

  set /p HOST_IP=Host IP address ^(e.g. 192.168.1.44^): 

)

if not defined HOST_IP (

  echo ERROR: Host IP required.

  pause

  exit /b 1

)



if not exist "%DEST%" mkdir "%DEST%"



echo.

echo  Checking host...

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^

  "try { $r = Invoke-WebRequest -Uri 'http://%HOST_IP%:%PORT%/api/artemis/health' -UseBasicParsing -TimeoutSec 5; if ($r.StatusCode -ne 200) { exit 1 }; exit 0 } catch { exit 1 }"

if errorlevel 1 (

  echo  ERROR: Cannot reach ARTEMIS on that IP.

  pause

  exit /b 1

)



set "BASE=http://%HOST_IP%:%PORT%/launchers/client"

set "FAIL=0"



for %%F in (READ-ME-FIRST.txt _artemis-launch-browser.bat ARTEMIS-JOIN.bat) do (

  echo   %%F ...

  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^

    "try { Invoke-WebRequest -Uri '%BASE%/%%F' -OutFile '%DEST%\%%F' -UseBasicParsing -TimeoutSec 15; exit 0 } catch { exit 1 }"

  if errorlevel 1 set "FAIL=1"

)



if "%FAIL%"=="1" (

  echo  Download failed.

  pause

  exit /b 1

)



(echo %HOST_IP%)> "%DEST%\artemis-host-ip.txt"



echo.

echo  Done: %DEST%\ARTEMIS-JOIN.bat

echo  Every game night: double-click ARTEMIS-JOIN.bat only.

echo.

set /p RUN=Run ARTEMIS-JOIN.bat now? [Y/n]: 

if /I not "%RUN%"=="n" start "" "%DEST%\ARTEMIS-JOIN.bat"

pause

endlocal

