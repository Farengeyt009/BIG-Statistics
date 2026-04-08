# Скрипт для запуска в Production режиме
# Frontend будет собран в dist и раздаваться через Flask
# Использование: .\start_production.ps1

# Устанавливаем кодировку UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 > $null

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Starting Production Server          " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = $PSScriptRoot
Set-Location $projectRoot

# Проверяем Python
Write-Host "Checking Python..." -ForegroundColor Yellow
$pythonCheck = Get-Command python -ErrorAction SilentlyContinue
if ($pythonCheck) {
    $pythonVersion = python --version 2>&1
    Write-Host "[OK] $pythonVersion" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Python not found!" -ForegroundColor Red
    exit 1
}

# Активируем виртуальное окружение
$venvPath = Join-Path $projectRoot "venv"
if (Test-Path $venvPath) {
    Write-Host "[OK] Activating virtual environment..." -ForegroundColor Green
    $activateScript = Join-Path $venvPath "Scripts\Activate.ps1"
    & $activateScript
} else {
    Write-Host "[INFO] Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
    $activateScript = Join-Path $venvPath "Scripts\Activate.ps1"
    & $activateScript
    
    Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
    pip install -r Back\requirements.txt
}

# Проверяем наличие собранного фронтенда
$distPath = Join-Path $projectRoot "Front\big-statistics-dashboard\dist"
if (!(Test-Path $distPath)) {
    Write-Host "[INFO] Frontend not built. Building now..." -ForegroundColor Yellow
    Set-Location "Front\big-statistics-dashboard"
    
    # Проверяем npm
    $npmCheck = Get-Command npm -ErrorAction SilentlyContinue
    if (!$npmCheck) {
        Write-Host "[ERROR] npm not found! Install Node.js first." -ForegroundColor Red
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
    Write-Host "[OK] Frontend build found" -ForegroundColor Green
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

# Добавляем текущую директорию в PYTHONPATH
$env:PYTHONPATH = $projectRoot

# ── Запускаем Migration Runner (continuous scripts) в отдельном окне ──
$migrationRoot = Join-Path $projectRoot "Migration"
if (Test-Path (Join-Path $migrationRoot "runner.py")) {
    Write-Host "Starting Migration Runner..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", `
        "Set-Location '$migrationRoot'; `$env:PYTHONPATH='$projectRoot'; python runner.py"
    Start-Sleep -Seconds 2
    Write-Host "[OK] Migration Runner started" -ForegroundColor Green
}

# ── Запускаем Migration Scheduler (scheduled scripts) в отдельном окне ──
if (Test-Path (Join-Path $migrationRoot "scheduler.py")) {
    Write-Host "Starting Migration Scheduler..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", `
        "Set-Location '$migrationRoot'; `$env:PYTHONPATH='$projectRoot'; python scheduler.py"
    Start-Sleep -Seconds 1
    Write-Host "[OK] Migration Scheduler started" -ForegroundColor Green
}

Write-Host ""

# Запускаем production сервер
$env:FLASK_ENV = "production"
python .\Back\Run_Server.py
