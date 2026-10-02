@echo off
setlocal
cd /d "%~dp0"
node scripts/claim-owner.mjs
if errorlevel 1 pause
