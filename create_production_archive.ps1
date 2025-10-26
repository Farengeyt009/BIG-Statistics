# Скрипт для создания архива проекта для продакшена
# Использование: .\create_production_archive.ps1

# Устанавливаем кодировку UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 > $null

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Creating Production Archive         " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = $PSScriptRoot
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$archiveName = "BIG_STATISTICS_PROD_$timestamp.zip"
$archivePath = Join-Path $projectRoot $archiveName

# Папки и файлы которые НЕ нужно включать в архив
$excludeFolders = @(
    "venv",
    "node_modules",
    "dist",
    "__pycache__",
    ".git",
    ".idea",
    ".vscode",
    "uploads\task_attachments"  # Временные файлы
)

$excludePatterns = @(
    "*.pyc",
    "*.pyo",
    "*.log",
    ".DS_Store",
    "Thumbs.db",
    "*.tmp"
)

Write-Host "Preparing files for archive..." -ForegroundColor Yellow
Write-Host ""

# Создаем временную папку для сборки
$tempFolder = Join-Path $projectRoot "temp_archive"
if (Test-Path $tempFolder) {
    Remove-Item -Recurse -Force $tempFolder
}
New-Item -ItemType Directory -Path $tempFolder | Out-Null

Write-Host "[INFO] Copying project files..." -ForegroundColor Cyan

# Копируем все файлы, исключая ненужные
Get-ChildItem -Path $projectRoot -Recurse | ForEach-Object {
    $relativePath = $_.FullName.Substring($projectRoot.Length + 1)
    
    # Проверяем, нужно ли исключить этот файл/папку
    $shouldExclude = $false
    
    # Проверка на исключаемые папки
    foreach ($excludeFolder in $excludeFolders) {
        if ($relativePath -like "$excludeFolder*") {
            $shouldExclude = $true
            break
        }
    }
    
    # Проверка на исключаемые паттерны файлов
    if (-not $shouldExclude) {
        foreach ($pattern in $excludePatterns) {
            if ($_.Name -like $pattern) {
                $shouldExclude = $true
                break
            }
        }
    }
    
    # Исключаем сам временный архив
    if ($relativePath -like "temp_archive*" -or $relativePath -like "BIG_STATISTICS_PROD_*.zip") {
        $shouldExclude = $true
    }
    
    # Копируем файл если он не исключен
    if (-not $shouldExclude) {
        $destPath = Join-Path $tempFolder $relativePath
        
        if ($_.PSIsContainer) {
            # Создаем папку
            if (-not (Test-Path $destPath)) {
                New-Item -ItemType Directory -Path $destPath -Force | Out-Null
            }
        } else {
            # Копируем файл
            $destDir = Split-Path $destPath -Parent
            if (-not (Test-Path $destDir)) {
                New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            }
            Copy-Item -Path $_.FullName -Destination $destPath -Force
        }
    }
}

Write-Host "[OK] Files copied to temp folder" -ForegroundColor Green
Write-Host ""

# Проверяем наличие .env файлов и предупреждаем
Write-Host "[INFO] Checking for .env files..." -ForegroundColor Cyan
$envFiles = Get-ChildItem -Path $tempFolder -Filter ".env" -Recurse
if ($envFiles.Count -gt 0) {
    Write-Host "[OK] Found .env files:" -ForegroundColor Green
    foreach ($envFile in $envFiles) {
        $relPath = $envFile.FullName.Substring($tempFolder.Length + 1)
        Write-Host "  - $relPath" -ForegroundColor White
    }
} else {
    Write-Host "[WARNING] No .env files found!" -ForegroundColor Yellow
    Write-Host "  Don't forget to configure .env on production!" -ForegroundColor Yellow
}
Write-Host ""

# Создаем список того, что включено в архив
Write-Host "[INFO] Archive will include:" -ForegroundColor Cyan
Write-Host "  - All source code (Back/)" -ForegroundColor White
Write-Host "  - Frontend source (Front/)" -ForegroundColor White
Write-Host "  - PowerShell scripts (*.ps1)" -ForegroundColor White
Write-Host "  - Requirements files" -ForegroundColor White
Write-Host "  - Configuration files (.env, config.py)" -ForegroundColor White
Write-Host "  - Documentation (*.md, *.txt)" -ForegroundColor White
Write-Host ""

Write-Host "[INFO] Archive will EXCLUDE:" -ForegroundColor Cyan
Write-Host "  - venv/" -ForegroundColor Gray
Write-Host "  - node_modules/" -ForegroundColor Gray
Write-Host "  - dist/" -ForegroundColor Gray
Write-Host "  - __pycache__/" -ForegroundColor Gray
Write-Host "  - .git/" -ForegroundColor Gray
Write-Host "  - Temporary files" -ForegroundColor Gray
Write-Host ""

# Создаем архив
Write-Host "Creating ZIP archive..." -ForegroundColor Yellow
try {
    Compress-Archive -Path "$tempFolder\*" -DestinationPath $archivePath -CompressionLevel Optimal -Force
    Write-Host "[OK] Archive created successfully!" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to create archive: $_" -ForegroundColor Red
    Remove-Item -Recurse -Force $tempFolder
    exit 1
}

# Удаляем временную папку
Remove-Item -Recurse -Force $tempFolder

# Получаем размер архива
$archiveSize = (Get-Item $archivePath).Length / 1MB
$archiveSizeFormatted = "{0:N2} MB" -f $archiveSize

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Archive Ready!                      " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Archive location: $archivePath" -ForegroundColor White
Write-Host "Archive size: $archiveSizeFormatted" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Next Steps for Production:         " -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Copy archive to production server" -ForegroundColor White
Write-Host "2. Extract the archive" -ForegroundColor White
Write-Host "3. Configure .env file (if not included)" -ForegroundColor White
Write-Host "4. Run: .\start_production.ps1" -ForegroundColor White
Write-Host ""
Write-Host "The script will automatically:" -ForegroundColor Green
Write-Host "  - Install Python dependencies" -ForegroundColor White
Write-Host "  - Install npm packages" -ForegroundColor White
Write-Host "  - Build frontend" -ForegroundColor White
Write-Host "  - Start the server" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to open archive location..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Открываем папку с архивом
Invoke-Item $projectRoot

