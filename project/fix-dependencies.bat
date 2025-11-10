@echo off
echo Fixing Vite dependency issue...
cd /d "c:\Users\jason\OneDrive\Desktop\bz\project"

echo Removing node_modules and package-lock.json...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json

echo Clearing npm cache...
call npm cache clean --force

echo Reinstalling dependencies...
call npm install

echo.
echo Done! Now you can run: npm run dev
pause
