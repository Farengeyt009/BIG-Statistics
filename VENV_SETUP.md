# Настройка виртуальной среды для BIG_STATISTICS

## Быстрая настройка (Windows PowerShell)

### 1. Создание виртуальной среды
```powershell
cd "C:\Users\pphea\Documents\My progect\BIG_STATISTICS"
python -m venv .venv
```

### 2. Активация виртуальной среды
```powershell
.\.venv\Scripts\Activate.ps1
```
После активации в командной строке появится префикс `(.venv)`

### 3. Установка зависимостей
```powershell
cd Back\BIG_STATISTICS
pip install -r requirements.txt
```

### 4. Проверка установки
```powershell
python -c "import flask, flask_cors; print('Все библиотеки установлены!')"
```

## Настройка VS Code

### Выбор правильного интерпретатора Python
1. Откройте VS Code в папке проекта
2. Нажмите `Ctrl + Shift + P`
3. Выберите `Python: Select Interpreter`
4. Выберите путь, заканчивающийся на `.venv\Scripts\python.exe`

### Проверка в VS Code
- Откройте любой Python файл
- VS Code должен показать выбранный интерпретатор в нижней панели
- Импорты Flask не должны подчеркиваться красным

## Запуск сервера

### В виртуальной среде
```powershell
# Убедитесь, что виртуальная среда активирована (префикс (.venv))
cd Back\BIG_STATISTICS
python Run_Server.py
```

### Проверка работы
Сервер должен запуститься на `http://127.0.0.1:5000/`

## Устранение проблем

### Ошибка "ModuleNotFoundError: No module named 'flask'"
1. Убедитесь, что виртуальная среда активирована
2. Проверьте, что VS Code использует правильный интерпретатор
3. Переустановите зависимости: `pip install -r requirements.txt`

### Ошибка "flask_cors not found"
1. Установите Flask-CORS: `pip install flask-cors`
2. Обновите requirements.txt: `pip freeze > requirements.txt`

### Проблемы с PowerShell
Если возникают проблемы с выполнением скриптов:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Полезные команды

### Деактивация виртуальной среды
```powershell
deactivate
```

### Просмотр установленных пакетов
```powershell
pip list
```

### Обновление requirements.txt
```powershell
pip freeze > requirements.txt
```

### Удаление виртуальной среды
```powershell
Remove-Item -Recurse -Force .venv
``` 