@echo off
setlocal
cd /d "%~dp0"
node scripts/local.mjs start
if errorlevel 1 pause
