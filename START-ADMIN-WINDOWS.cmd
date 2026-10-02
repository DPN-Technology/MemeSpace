@echo off
setlocal
cd /d "%~dp0"
node admin/server.mjs
if errorlevel 1 pause
