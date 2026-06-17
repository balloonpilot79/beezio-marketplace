@echo off
setlocal

REM Convenience wrapper for PowerShell deploy script
cd /d "%~dp0.."

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-messaging-functions.ps1"

pause
