@echo off
setlocal

cd /d "%~dp0"

for %%I in ("%~dp0.") do set "ROOT_DIR=%%~fI"
for %%I in ("%~dp0backend") do set "BACKEND_DIR=%%~fI"
set "BACKEND_ENV=%BACKEND_DIR%\.env"
set "KOBOLD_LAUNCHER=%BACKEND_DIR%\koboldcpp-launch.bat"

echo.
echo === Jianghu DM Local LLM One-Click Launcher ===
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
  echo Please copy backend\.env.example to backend\.env and fill in your settings first.
  echo.
  echo Suggested command:
  echo Copy-Item .\backend\.env.example .\backend\.env
  pause
  exit /b 1
)

if not exist "%ROOT_DIR%\node_modules" (
  echo Frontend dependencies are missing. Installing them now...
  call npm install --cache .npm-cache
  if errorlevel 1 (
    echo.
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Starting local stack...
echo.

if exist "%KOBOLD_LAUNCHER%" (
  if defined DRY_RUN (
    echo [dry-run] start "KoboldCpp" cmd /k "cd /d ""%BACKEND_DIR%"" ^&^& call ""%KOBOLD_LAUNCHER%"""
  ) else (
    start "KoboldCpp" cmd /k "cd /d ""%BACKEND_DIR%"" && call ""%KOBOLD_LAUNCHER%"""
  )
  call :wait_seconds 2
) else (
  echo No backend\koboldcpp-launch.bat found. Skipping automatic koboldcpp launch.
  echo If koboldcpp is not already running, bridge requests will fail.
  echo.
)

if defined DRY_RUN (
  echo [dry-run] start "Jianghu Backend Service" cmd /k "cd /d ""%BACKEND_DIR%"" ^&^& npm run start:service"
) else (
  start "Jianghu Backend Service" cmd /k "cd /d ""%BACKEND_DIR%"" && npm run start:service"
)
call :wait_seconds 2

if defined DRY_RUN (
  echo [dry-run] start "Jianghu Backend Bridge" cmd /k "cd /d ""%BACKEND_DIR%"" ^&^& npm run start:bridge"
) else (
  start "Jianghu Backend Bridge" cmd /k "cd /d ""%BACKEND_DIR%"" && npm run start:bridge"
)
call :wait_seconds 2

if defined DRY_RUN (
  echo [dry-run] start "Jianghu Frontend Dev Server" cmd /k "cd /d ""%ROOT_DIR%"" ^&^& npm run dev"
) else (
  start "Jianghu Frontend Dev Server" cmd /k "cd /d ""%ROOT_DIR%"" && npm run dev"
)
call :wait_seconds 4

echo.
echo All launch commands were sent.
echo Frontend address: http://localhost:5173/
echo.
echo In the game settings, use:
echo API URL: http://127.0.0.1:8787/v1/chat/completions
echo API Key: your CLIENT_API_KEY from backend\.env
echo Model: your KOBOLD_MODEL from backend\.env
echo.
echo If something does not work, check the opened windows for error messages.
echo.
exit /b 0

:wait_seconds
if defined DRY_RUN (
  echo [dry-run] timeout /t %~1 /nobreak
) else (
  timeout /t %~1 /nobreak >nul
)
exit /b 0
