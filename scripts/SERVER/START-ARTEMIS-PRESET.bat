@echo off

setlocal EnableDelayedExpansion

title ARTEMIS - PRESET HOST (Guido R2 cardplay)

REM Host PC — skips setup deploy; injects mid-game state after fast-boot login.



cd /d "%~dp0"



call "%~dp0_artemis-lib.bat" ensurenode

if errorlevel 1 pause & exit /b 1



call "%~dp0_artemis-lib.bat" ensurenpm

if errorlevel 1 pause & exit /b 1



call "%~dp0_artemis-lib.bat" killport

call "%~dp0_artemis-lib.bat" lanip



echo.

echo  Starting server window...

start "ARTEMIS Server - DO NOT CLOSE" /D "%ARTEMIS_GAME_ROOT%" cmd /k call "%~dp0_run-server.bat"



echo  Waiting for server...

set "SERVER_OK=0"

for /L %%N in (1,1,15) do (

  timeout /t 1 /nobreak >nul

  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^

    "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:%ARTEMIS_PORT%/api/artemis/health' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"

  if not errorlevel 1 set "SERVER_OK=1" & goto :ready

)

:ready

if not "%SERVER_OK%"=="1" (

  echo.

  echo  ERROR: Server did not start. Check the server window for errors.

  pause

  exit /b 1

)



set "HOST_URL=http://127.0.0.1:%ARTEMIS_PORT%/game.html?artemis=host&slot=1&artemisPreset=guidoR2Cardplay&phase=login&loginLegacyNext=game.html%%3Fphase%%3Dcardplay%%26legacyNext%%3Dincome.html&loginLoadRedirect=game.html%%3Fphase%%3Dcardplay%%26legacyNext%%3Dincome.html"

echo.

echo  Opening PRESET host (Guido round 2 cardplay)...

start "" "!HOST_URL!"



(echo !ARTEMIS_LAN_IP!)> "%~dp0artemis-host-ip.txt"

if exist "%~dp0..\LAPTOP 2\" (echo !ARTEMIS_LAN_IP!)> "%~dp0..\LAPTOP 2\artemis-host-ip.txt"

if exist "%~dp0..\LAPTOP 3\" (echo !ARTEMIS_LAN_IP!)> "%~dp0..\LAPTOP 3\artemis-host-ip.txt"



cls

echo.

echo  ============================================================

echo   ARTEMIS PRESET HOST — Guido R2 cardplay

echo  ============================================================

echo.

echo   Fast boot login still runs (3 laptops auto JOIN).

echo   After login: host injects preset map + Guido 1 card.

echo   Skips welcome, deal, and setup deploy entirely.

echo.

echo   Optional: add ^&artemisPresetSeed=12345 to HOST URL for

echo   repeatable random maps (same seed = same board).

echo.

echo   Laptops 2 and 3: use normal JOIN.bat, then hard refresh.

echo.

echo   Host IP: !ARTEMIS_LAN_IP!

echo.

echo  ============================================================

pause

endlocal

