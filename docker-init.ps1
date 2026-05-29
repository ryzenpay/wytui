#!/usr/bin/env pwsh
# Docker Compose initialization script
# Generates secure credentials if they don't exist

$ErrorActionPreference = "Stop"

$ENV_FILE = ".env"

# Check if .env exists
if (-not (Test-Path $ENV_FILE)) {
    Write-Host "No .env file found. Generating secure credentials..." -ForegroundColor Cyan

    # Generate secure random secrets (32 bytes = 64 hex chars)
    $POSTGRES_PASSWORD = -join ((1..32 | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) }))
    $AUTH_SECRET = -join ((1..32 | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) }))

    # Get current date
    $DATE = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

    # Create .env file
    @"
# Auto-generated secure credentials
# Generated: $DATE
# DO NOT commit this file to git

POSTGRES_USER=postgres
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=wytui
AUTH_SECRET=$AUTH_SECRET

# Optional: Override these for custom configuration
# ORIGIN=http://localhost:3000
# ADMIN_USERNAME=admin@example.com
# ADMIN_PASSWORD=your-secure-password
"@ | Out-File -FilePath $ENV_FILE -Encoding utf8

    Write-Host "[OK] Created $ENV_FILE with secure random credentials" -ForegroundColor Green
    Write-Host ""
    Write-Host "[!] IMPORTANT: Save this file securely! You'll need it to access your data." -ForegroundColor Yellow
    Write-Host "    Location: $(Get-Location)\$ENV_FILE" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "[OK] Using existing $ENV_FILE" -ForegroundColor Green
}

# Check if credentials are set
$envContent = Get-Content $ENV_FILE -Raw
if ($envContent -match "POSTGRES_PASSWORD=\s*$" -or $envContent -match "AUTH_SECRET=\s*$") {
    Write-Host "[!] WARNING: Empty credentials detected in $ENV_FILE" -ForegroundColor Red
    Write-Host "    Please set POSTGRES_PASSWORD and AUTH_SECRET" -ForegroundColor Red
    exit 1
}

Write-Host "Starting Docker Compose..." -ForegroundColor Cyan
if ($args.Count -eq 0) {
    docker compose up --build
} else {
    docker compose $args
}
