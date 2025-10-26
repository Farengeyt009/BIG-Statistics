# 🚀 Руководство по запуску через PowerShell

## 📋 Содержание
- [Требования](#требования)
- [Быстрый старт](#быстрый-старт)
- [Режимы запуска](#режимы-запуска)
- [Решение проблем](#решение-проблем)

---

## ✅ Требования

### Установленное ПО:
1. **Python 3.8+** - для бэкенда
2. **Node.js 18+** - для фронтенда
3. **PowerShell 5.1+** - встроен в Windows 10/11

### Проверка установки:
```powershell
# Проверить Python
python --version

# Проверить Node.js
node --version

# Проверить PowerShell
$PSVersionTable.PSVersion
```

---

## 🚀 Быстрый старт

### 1️⃣ Разработка (Development)

Для разработки с **hot-reload**:

```powershell
# Запустить ВСЁ (Backend + Frontend)
.\start_all.ps1

# ИЛИ запускать по отдельности:

# Только Backend
.\start_backend.ps1

# Только Frontend
.\start_frontend.ps1
```

**URLs:**
- Backend API: http://localhost:5000/api
- Frontend Dev: http://localhost:3000

---

### 2️⃣ Продакшн (Production)

Для продакшн сервера (фронт встроен в бэкенд):

```powershell
# Запустить production сервер
.\start_production.ps1
```

**URL:**
- Application: http://localhost:5000

---

## 📖 Режимы запуска

### Development режим
```powershell
.\start_all.ps1
```
**Что происходит:**
1. Откроется 2 окна PowerShell
2. В одном запустится Flask (Backend) на порту 5000
3. В другом запустится Vite (Frontend) на порту 3000
4. Hot-reload работает для обоих

**Когда использовать:**
- Во время разработки
- Для тестирования изменений
- Для отладки

---

### Production режим
```powershell
.\start_production.ps1
```
**Что происходит:**
1. Проверяется наличие собранного фронтенда (`dist`)
2. Если нет - автоматически собирается (`npm run build`)
3. Запускается один Flask сервер
4. Flask раздаёт статику фронтенда из `dist`

**Когда использовать:**
- На продакшн сервере
- Для финального тестирования перед деплоем
- Для демонстрации клиенту

---

## 🔧 Решение проблем

### Проблема: "Не удается загрузить файл... выполнение сценариев отключено"

**Решение:**
```powershell
# Запустите PowerShell от имени Администратора и выполните:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Затем попробуйте снова.

---

### Проблема: "Python не найден"

**Решение:**
1. Установите Python с https://python.org
2. При установке отметьте "Add Python to PATH"
3. Перезапустите PowerShell

---

### Проблема: "Node.js не найден"

**Решение:**
1. Установите Node.js с https://nodejs.org
2. Выберите LTS версию
3. Перезапустите PowerShell

---

### Проблема: Порт 5000 или 3000 занят

**Решение:**
```powershell
# Найти процесс на порту 5000
netstat -ano | findstr :5000

# Убить процесс (замените PID на номер из предыдущей команды)
taskkill /PID <PID> /F

# То же самое для порта 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

---

### Проблема: Ошибки импорта в Python

**Решение:**
```powershell
# Активируйте виртуальное окружение
.\venv\Scripts\Activate.ps1

# Переустановите зависимости
pip install -r requirements.txt --force-reinstall
```

---

### Проблема: Frontend не собирается

**Решение:**
```powershell
cd Front\big-statistics-dashboard

# Удалите node_modules и package-lock.json
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json

# Переустановите зависимости
npm install

# Попробуйте собрать
npm run build
```

---

## 📝 Дополнительные команды

### Остановить все серверы:
```powershell
# Найти все процессы Python
Get-Process python | Stop-Process -Force

# Найти все процессы Node
Get-Process node | Stop-Process -Force
```

### Пересобрать фронтенд вручную:
```powershell
cd Front\big-statistics-dashboard
npm run build
```

### Очистить кэш Python:
```powershell
# Удалить все __pycache__
Get-ChildItem -Path . -Recurse -Filter "__pycache__" | Remove-Item -Recurse -Force

# Удалить все .pyc файлы
Get-ChildItem -Path . -Recurse -Filter "*.pyc" | Remove-Item -Force
```

---

## 🎯 Рекомендации

### Для разработки:
- Используйте `start_all.ps1`
- Держите оба окна открытыми
- Изменения применяются автоматически

### Для продакшена:
- Используйте `start_production.ps1`
- Следите за логами в консоли
- Используйте `debug=False` в `Run_Server.py`

---

## 📞 Поддержка

Если проблема не решена:
1. Проверьте логи в окнах PowerShell
2. Проверьте файл `Run_Server.py` на ошибки
3. Убедитесь что все зависимости установлены

---

**Создано:** 2025-01-26
**Обновлено:** 2025-01-26

