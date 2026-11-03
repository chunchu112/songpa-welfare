@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or is not available in PATH.
  echo Install the current LTS release from https://nodejs.org/en/download/
  echo Then close and reopen this window and run start-local.bat again.
  pause
  exit /b 1
)
node server.js
pause
