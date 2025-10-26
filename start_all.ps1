# Скрипт для запуска Backend и Frontend одновременно
# Использование: .\start_all.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Starting Full Application Stack     " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = $PSScriptRoot

Write-Host "This will start:" -ForegroundColor Yellow
Write-Host "  • Backend (Flask) on http://localhost:5000" -ForegroundColor White
Write-Host "  • Frontend (Vite) on http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "Two PowerShell windows will open." -ForegroundColor Yellow
Write-Host "Close them to stop the servers." -ForegroundColor Yellow
Write-Host ""

# Запускаем Backend в отдельном окне
Write-Host "Starting Backend server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-File", "$projectRoot\start_backend.ps1"

# Ждём 3 секунды, чтобы backend успел запуститься
Start-Sleep -Seconds 3

# Запускаем Frontend в отдельном окне
Write-Host "Starting Frontend server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-File", "$projectRoot\start_frontend.ps1"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✓ Both servers are starting!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend:  http://localhost:5000" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "Check the opened windows for server status." -ForegroundColor Yellow
Write-Host "You can close this window now." -ForegroundColor Gray

