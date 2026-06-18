@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "GAME_URL=http://127.0.0.1:5173/"

cd /d "%ROOT_DIR%"

echo [1/3] Check dependencies...
if not exist "node_modules" (
  echo node_modules not found. Installing dependencies first...
  call npm install --cache .npm-cache
  if errorlevel 1 (
    echo Dependency install failed. Please check Node.js and npm.
    pause
    exit /b 1
  )
)

echo [2/3] Start local game server...
start "Jianghu DM Dev Server" cmd /k "cd /d ""%ROOT_DIR%"" && npm run dev"

echo [3/3] Open browser...
timeout /t 4 /nobreak >nul
start "" "%GAME_URL%"

echo Game launch requested.
echo If the page does not load at first, wait for the dev server and refresh once.
pause
