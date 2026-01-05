@echo off
setlocal

REM Logs in to Supabase CLI using an access token (paste locally, never in chat).
REM Usage:
REM   scripts\supabase-login.cmd

cd /d "%~dp0.."

echo Working directory: %CD%
echo.

where supabase >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo ERROR: supabase CLI not found in PATH.
  echo Install from https://supabase.com/docs/guides/cli
  exit /b 1
)

echo Logging out of any existing session...
supabase logout --yes
echo.

echo Create a NEW access token in Supabase Dashboard ^> Account ^> Access Tokens.
echo Paste it below. This will be visible on-screen while pasting.
echo.
set /p SB_TOKEN=Supabase access token: 
echo.

if "%SB_TOKEN%"=="" (
  echo ERROR: No token provided.
  exit /b 2
)

echo Logging in...
supabase login --token "%SB_TOKEN%" --name beezio
if %ERRORLEVEL% neq 0 (
  echo ERROR: Login failed.
  exit /b %ERRORLEVEL%
)

echo.
echo Listing projects (you should see yemgssttxhkgrivuodbz)...
supabase projects list

echo.
echo Done.
pause
