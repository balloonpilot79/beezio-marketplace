param(
  [string]$ProjectRef = $null,
  [switch]$All
)

$ErrorActionPreference = 'Stop'

function Get-ProjectRef {
  if ($ProjectRef) { return $ProjectRef }

  $refFile = Join-Path $PSScriptRoot '..\supabase\.temp\project-ref'
  if (Test-Path $refFile) {
    $ref = (Get-Content $refFile -Raw).Trim()
    if ($ref) { return $ref }
  }

  throw "Project ref not provided and not found at $refFile"
}

function Assert-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Missing '$name' in PATH. Install it first."
  }
}

Assert-Command 'supabase'

$ref = Get-ProjectRef
Write-Host "Deploying messaging Edge Functions to project: $ref" -ForegroundColor Cyan

# If -All is passed, deploy everything in supabase/functions.
# Otherwise deploy only the messaging-related set.
$functions = @(
  'start-store-conversation',
  'send-store-message',
  'mark-store-conversation-read',
  'create-support-thread',
  'send-support-message',
  'mark-support-thread-read',
  'admin-create-announcement',
  'mark-announcement-read',
  'admin-send-direct-message',
  'create-dispute-thread',
  'send-dispute-message'
)

if ($All) {
  $functions = @() # empty => deploy all (CLI behavior)
}

try {
  if ($functions.Count -eq 0) {
    Write-Host "Deploying ALL functions (this may take a while)..." -ForegroundColor Yellow
    supabase functions deploy --project-ref $ref --use-api
  } else {
    foreach ($fn in $functions) {
      Write-Host "\n==> Deploying: $fn" -ForegroundColor Yellow
      supabase functions deploy $fn --project-ref $ref --use-api
    }
  }

  Write-Host "\nDone. If you saw 403 privilege errors, re-run after logging in:" -ForegroundColor Green
  Write-Host "  `$env:SB_TOKEN='sbp_...'; .\scripts\supabase-login.cmd" -ForegroundColor Green
} catch {
  Write-Host "\nDeployment failed: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "\nCommon fix:" -ForegroundColor Yellow
  Write-Host "  1) Create a Supabase Access Token (Dashboard > Account > Access Tokens)" -ForegroundColor Yellow
  Write-Host "  2) In PowerShell: `$env:SB_TOKEN='sbp_...'; .\scripts\supabase-login.cmd" -ForegroundColor Yellow
  Write-Host "  3) Re-run: .\scripts\deploy-messaging-functions.ps1" -ForegroundColor Yellow
  throw
}
