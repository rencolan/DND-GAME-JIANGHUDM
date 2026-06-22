@echo off
setlocal

rem Copy this file to backend\koboldcpp-launch.bat and edit the values below.
rem Then start-local-llm-stack.bat can launch koboldcpp for you automatically.

set "KOBOLDCPP_EXE=C:\path\to\koboldcpp.exe"
set "KOBOLDCPP_ARGS=--host 127.0.0.1 --port 5001 --model C:\path\to\your-model.gguf"

if not exist "%KOBOLDCPP_EXE%" (
  echo.
  echo koboldcpp executable not found:
  echo %KOBOLDCPP_EXE%
  pause
  exit /b 1
)

"%KOBOLDCPP_EXE%" %KOBOLDCPP_ARGS%

