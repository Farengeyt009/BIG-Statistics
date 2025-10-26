# Скрипт для запуска Backend сервера
# Использование: .\start_backend.ps1

# Устанавливаем кодировку UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 > $null

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Starting Backend Server (Flask)     " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Переходим в директорию проекта
$projectRoot = $PSScriptRoot
Set-Location $projectRoot

# Проверяем наличие Python
Write-Host "Checking Python installation..." -ForegroundColor Yellow
$pythonCheck = Get-Command python -ErrorAction SilentlyContinue
if ($pythonCheck) {
    $pythonVersion = python --version 2>&1
    Write-Host "[OK] Found: $pythonVersion" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Python not found! Please install Python 3.8+" -ForegroundColor Red
    exit 1
}

# Проверяем наличие виртуального окружения
$venvPath = Join-Path $projectRoot "venv"
if (Test-Path $venvPath) {
    Write-Host "[OK] Virtual environment found" -ForegroundColor Green
    Write-Host "Activating virtual environment..." -ForegroundColor Yellow
    
    $activateScript = Join-Path $venvPath "Scripts\Activate.ps1"
    if (Test-Path $activateScript) {
        & $activateScript
    } else {
        Write-Host "[WARNING] Activate.ps1 not found, trying direct execution" -ForegroundColor Yellow
    }
} else {
    Write-Host "[INFO] Virtual environment not found" -ForegroundColor Yellow
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
    
    $activateScript = Join-Path $venvPath "Scripts\Activate.ps1"
    & $activateScript
    
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    pip install -r Back\requirements.txt
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Flask server on port 5000..." -ForegroundColor Cyan
Write-Host "Backend URL: http://localhost:5000" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Добавляем текущую директорию в PYTHONPATH для импорта модуля Back
$env:PYTHONPATH = $projectRoot

# Запускаем сервер
python .\Back\Run_Server.py
