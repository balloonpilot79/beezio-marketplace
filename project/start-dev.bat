@echo off
echo Starting Beezio development server...
echo.
cd /d "%~dp0"
echo Stopping any existing servers on ports 5173-5175...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5174') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5175') do taskkill /f /pid %%a >nul 2>&1
echo.
echo Starting Vite development server...
npx vite --force --port 5173
pause