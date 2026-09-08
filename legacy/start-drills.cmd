@echo off
title Interview Drills
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found on this machine.
  echo Install it from https://nodejs.org and run this again.
  echo.
  pause
  exit /b 1
)

node server.js

echo.
echo The server has stopped.
pause
