@echo off
setlocal

cd /d "%~dp0"

for %%I in ("%~dp0backend") do set "BACKEND_DIR=%%~fI"
set "BACKEND_ENV=%BACKEND_DIR%\.env"
set "KOBOLD_LAUNCHER=%BACKEND_DIR%\koboldcpp-launch.bat"

echo.
echo === Jianghu DM Remote Bridge Launcher ===
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found in PATH.
  echo Please install Node.js first, then run this script again.
  pause
  exit /b 1
)

if not exist "%BACKEND_ENV%" (
  echo backend\.env was not found.
  echo Please create backend\.env first.
  pause
  exit /b 1
)

if not exist "%KOBOLD_LAUNCHER%" (
  echo backend\koboldcpp-launch.bat was not found.
  echo Please create it first, or copy backend\koboldcpp-launch.example.bat and edit it.
  pause
  exit /b 1
)

echo Starting koboldcpp and bridge for the Render backend...
echo.

call :launch "KoboldCpp" cmd /k "cd /d ""%BACKEND_DIR%"" && call ""%KOBOLD_LAUNCHER%"""
call :wait_seconds 3

call :launch "Jianghu Backend Bridge" cmd /k "cd /d ""%BACKEND_DIR%"" && npm run start:bridge"
call :wait_seconds 2

echo.
echo Launch commands sent.
echo Render backend: https://dnd-game-jianghudm.onrender.com
echo Bridge target: read from backend\.env
echo Local koboldcpp endpoint should stay at: http://127.0.0.1:5001/v1/chat/completions
echo.
echo Keep both windows open while playing remotely.
echo.
exit /b 0

:launch
set "WINDOW_TITLE=%~1"
shift
if defined DRY_RUN (
  echo [dry-run] start "%WINDOW_TITLE%" %*
) else (
  start "%WINDOW_TITLE%" %*
)
exit /b 0

:wait_seconds
if defined DRY_RUN (
  echo [dry-run] timeout /t %~1 /nobreak
) else (
  timeout /t %~1 /nobreak >nul
)
exit /b 0

