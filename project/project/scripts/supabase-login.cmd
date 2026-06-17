@echo off
setlocal

REM Logs in to Supabase CLI using an access token.
REM IMPORTANT: This script is NON-INTERACTIVE to avoid terminal freezes.
REM Provide the token via:
REM   - environment variable: SB_TOKEN or SUPABASE_ACCESS_TOKEN
REM   - argument 1: scripts\supabase-login.cmd sbp_xxx
REM Examples:
REM   PowerShell:  $env:SB_TOKEN = 'sbp_xxx'; .\scripts\supabase-login.cmd
REM   CMD:         set SB_TOKEN=sbp_xxx & scripts\supabase-login.cmd

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
echo This script will NOT prompt for a token.
echo.

set "_ARG_TOKEN=%~1"
if not "%_ARG_TOKEN%"=="" set "SB_TOKEN=%_ARG_TOKEN%"
if "%SB_TOKEN%"=="" set "SB_TOKEN=%SUPABASE_ACCESS_TOKEN%"

if "%SB_TOKEN%"=="" (
  echo ERROR: No token provided.
  echo.
  echo Set SB_TOKEN or SUPABASE_ACCESS_TOKEN, or pass token as argument.
  echo   PowerShell:  $env:SB_TOKEN = 'sbp_xxx'; .\scripts\supabase-login.cmd
  echo   CMD:         set SB_TOKEN=sbp_xxx ^& scripts\supabase-login.cmd
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
