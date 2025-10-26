# Скрипт для запуска в Production режиме
# Frontend будет собран в dist и раздаваться через Flask
# Использование: .\start_production.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Starting Production Server          " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = $PSScriptRoot
Set-Location $projectRoot

# Проверяем Python
Write-Host "Checking Python..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✓ $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Python not found!" -ForegroundColor Red
    exit 1
}

# Активируем виртуальное окружение
$venvPath = Join-Path $projectRoot "venv"
if (Test-Path $venvPath) {
    Write-Host "✓ Activating virtual environment..." -ForegroundColor Green
    & "$venvPath\Scripts\Activate.ps1"
} else {
    Write-Host "! Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
    & "$venvPath\Scripts\Activate.ps1"
    pip install -r requirements.txt
}

# Проверяем наличие собранного фронтенда
$distPath = Join-Path $projectRoot "Front\big-statistics-dashboard\dist"
if (!(Test-Path $distPath)) {
    Write-Host "! Frontend not built. Building now..." -ForegroundColor Yellow
    Set-Location "Front\big-statistics-dashboard"
    
    # Проверяем npm
    if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Host "✗ npm not found! Install Node.js first." -ForegroundColor Red
        exit 1
    }
    
    # Устанавливаем зависимости если нужно
    if (!(Test-Path "node_modules")) {
        Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
        npm install
    }
    
    # Собираем фронтенд
    Write-Host "Building frontend..." -ForegroundColor Yellow
    npm run build
    
    Set-Location $projectRoot
} else {
    Write-Host "✓ Frontend build found" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Production Server..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Application URL: http://localhost:5000" -ForegroundColor Green
Write-Host "  or: http://0.0.0.0:5000" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Запускаем production сервер
$env:FLASK_ENV = "production"
python Back/Run_Server.py

