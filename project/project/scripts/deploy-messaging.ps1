$ErrorActionPreference = "Stop"

function Fail($message) {
  Write-Error $message
  exit 1
}

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  Fail "Supabase CLI not found. Install with: npm i -g supabase"
}

function Ensure-SupabaseAuth {
  supabase projects list | Out-Null
  if ($LASTEXITCODE -eq 0) {
    return
  }

  if ($env:SUPABASE_ACCESS_TOKEN) {
    Write-Host "Supabase not authenticated; using SUPABASE_ACCESS_TOKEN to login..." -ForegroundColor Yellow
    supabase login --token $env:SUPABASE_ACCESS_TOKEN --name beezio | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Fail "Supabase login failed. Verify SUPABASE_ACCESS_TOKEN is valid (and not revoked)."
    }
    return
  }

  Fail "Supabase access token not provided. Run: supabase login OR set SUPABASE_ACCESS_TOKEN for this session."
}

Write-Host "Deploying messaging schema and functions..." -ForegroundColor Cyan

Ensure-SupabaseAuth

supabase db push
if ($LASTEXITCODE -ne 0) { Fail "supabase db push failed." }

supabase functions deploy start-store-conversation send-store-message mark-store-conversation-read create-support-thread send-support-message mark-support-thread-read admin-create-announcement mark-announcement-read admin-send-direct-message
if ($LASTEXITCODE -ne 0) { Fail "supabase functions deploy failed." }

Write-Host "Messaging deployment complete." -ForegroundColor Green
