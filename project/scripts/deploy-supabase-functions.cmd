@echo off
REM Windows wrapper to push secrets and deploy Supabase Edge Functions.
REM Usage: deploy-supabase-functions.cmd <project-ref>
@echo off
REM Windows wrapper to push secrets and deploy Supabase Edge Functions.
REM Usage: deploy-supabase-functions.cmd <project-ref>

if "%~1"=="" (
  echo Usage: deploy-supabase-functions.cmd ^<project-ref^>
  exit /b 2
)
set PROJECT_REF=%~1

echo Pushing secrets from .env to Supabase project %PROJECT_REF% ...
node scripts\push-secrets-to-supabase.mjs %PROJECT_REF%
if %ERRORLEVEL% neq 0 (
  echo Failed to push secrets. Aborting.
  exit /b %ERRORLEVEL%
)

echo Deploying Edge Functions...
echo (You need the supabase CLI installed and logged in)
for /d %%f in (supabase\functions\*) do (
  set "fn=%%~nxf"
  call :deployFunc "%%~nxf"
)

echo Deployment complete.
pause

:deployFunc
REM %1 is function directory name
set "fname=%~1"
echo Deploying function %fname% ...
supabase functions deploy %fname% --project-ref %PROJECT_REF%
if %ERRORLEVEL% neq 0 (
  echo Failed to deploy %fname%. Aborting.
  exit /b %ERRORLEVEL%
)
goto :eof
