@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 or newer, then reopen this file.
  pause
  exit /b 1
)
node scripts/local.mjs setup
if errorlevel 1 (
  echo Setup stopped. Read the error above.
  pause
  exit /b 1
)
echo Setup is complete. Open START-WINDOWS.cmd next.
pause
