# Beezio Database Setup Script
# Run this in PowerShell: .\setup-database.ps1

Write-Host "🚀 Beezio Database Auto-Setup" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# Check if Node.js is available
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}

# Navigate to project directory
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectPath

Write-Host "📂 Project directory: $projectPath" -ForegroundColor Yellow

# Check for .env file
if (!(Test-Path ".env")) {
    Write-Host "❌ .env file not found. Please create it with your Supabase credentials." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found .env file" -ForegroundColor Green

# Try multiple automation methods
Write-Host "🔄 Trying automated setup methods..." -ForegroundColor Yellow

# Method 1: Try npm script
Write-Host "📦 Method 1: NPM populate script..." -ForegroundColor Cyan
try {
    npm run populate-db
    Write-Host "✅ Method 1 completed" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Method 1 failed, trying next method..." -ForegroundColor Yellow
}

# Method 2: Try Node.js automation script
if (Test-Path "automated-setup.js") {
    Write-Host "🤖 Method 2: Automated setup script..." -ForegroundColor Cyan
    try {
        node automated-setup.js
        Write-Host "✅ Method 2 completed" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Method 2 failed, trying next method..." -ForegroundColor Yellow
    }
}

# Method 3: Try quick setup
if (Test-Path "quick-db-setup.js") {
    Write-Host "⚡ Method 3: Quick setup script..." -ForegroundColor Cyan
    try {
        node quick-db-setup.js
        Write-Host "✅ Method 3 completed" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Method 3 failed" -ForegroundColor Yellow
    }
}

Write-Host "" -ForegroundColor White
Write-Host "🎉 Setup process complete!" -ForegroundColor Green
Write-Host "🌐 Your site should be running at: http://localhost:5173/" -ForegroundColor Green
Write-Host "" -ForegroundColor White
Write-Host "If automated setup didn't work completely:" -ForegroundColor Yellow
Write-Host "1. Open database-setup.html in your browser" -ForegroundColor Yellow
Write-Host "2. Click the 'Start Automated Setup' button" -ForegroundColor Yellow
Write-Host "3. Or manually run SQL files in Supabase dashboard" -ForegroundColor Yellow

Read-Host "Press Enter to continue..."
