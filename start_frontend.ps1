# Скрипт для запуска Frontend сервера (Development)
# Использование: .\start_frontend.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Starting Frontend Server (Vite)     " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Переходим в директорию фронтенда
$frontendPath = Join-Path $PSScriptRoot "Front\big-statistics-dashboard"
Set-Location $frontendPath

# Проверяем наличие Node.js
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    Write-Host "✓ Found Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found! Please install Node.js 18+" -ForegroundColor Red
    exit 1
}

# Проверяем наличие node_modules
if (!(Test-Path "node_modules")) {
    Write-Host "! node_modules not found" -ForegroundColor Yellow
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
} else {
    Write-Host "✓ node_modules found" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Vite dev server..." -ForegroundColor Cyan
Write-Host "Frontend URL: http://localhost:3000" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Запускаем dev сервер
npm run dev

