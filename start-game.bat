@echo off
setlocal

cd /d "%~dp0"

echo Installing dependencies...
call npm install
if errorlevel 1 (
  echo.
  echo npm install failed.
  pause
  exit /b 1
)

echo.
echo Starting dev server in a new window...
start "Jianghu DM Dev Server" cmd /k "cd /d ""%~dp0"" && npm run dev"

echo Waiting for dev server...
timeout /t 4 /nobreak >nul

echo Opening browser...
start "" "http://localhost:5173/"
