# Инструкции по установке и запуску BIG_STATISTICS

## 📋 Предварительные требования

### Системные требования
- **ОС**: Windows 10/11, macOS, Linux
- **Python**: 3.8 или выше
- **Node.js**: 16.0 или выше
- **SQL Server**: 2019 или выше
- **ODBC Driver**: Microsoft ODBC Driver 18 for SQL Server

### Необходимые инструменты
- **Git**: для клонирования репозитория
- **PyCharm/VS Code**: для разработки
- **SQL Server Management Studio**: для работы с БД

## 🚀 Быстрый старт

### 1. Клонирование репозитория
```bash
git clone <repository-url>
cd BIG_STATISTICS
```

### 2. Настройка Backend

#### Шаг 1: Создание виртуального окружения
```bash
cd Back
python -m venv .venv
```

#### Шаг 2: Активация виртуального окружения
**Windows (PowerShell):**
```powershell
.\.venv\Scripts\Activate.ps1
```

**Windows (Command Prompt):**
```cmd
.\.venv\Scripts\activate.bat
```

**macOS/Linux:**
```bash
source .venv/bin/activate
```

#### Шаг 3: Установка зависимостей
```bash
pip install -r requirements.txt
cd BIG_STATISTICS
pip install -r requirements.txt
```

#### Шаг 4: Настройка переменных окружения
Создайте файл `.env` в папке `Back/BIG_STATISTICS/`:
```env
DB_SERVER=your_server_name
DB_NAME=your_database_name
DB_USER=your_username
DB_PASSWORD=your_password
```

#### Шаг 5: Проверка установки
```bash
python Check\ pip.py
```

### 3. Настройка Frontend

#### Шаг 1: Переход в папку фронтенда
```bash
cd ../../Front/big-statistics-dashboard
```

#### Шаг 2: Установка зависимостей
```bash
npm install
```

#### Шаг 3: Проверка установки
```bash
npm run dev
```

## 🔧 Подробная настройка

### Настройка базы данных

#### 1. Установка SQL Server
1. Скачайте SQL Server с официального сайта Microsoft
2. Установите SQL Server с настройками по умолчанию
3. Запомните имя сервера (обычно `localhost` или `localhost\SQLEXPRESS`)

#### 2. Установка ODBC Driver
1. Скачайте Microsoft ODBC Driver 18 for SQL Server
2. Установите драйвер для вашей системы
3. Проверьте установку в "Диспетчере источников данных ODBC"

#### 3. Создание базы данных
```sql
-- Подключитесь к SQL Server через SSMS
CREATE DATABASE BigStatistics;
GO

USE BigStatistics;
GO

-- Создание таблицы незавершенных заказов
CREATE TABLE dbo.Uncompleted_Orders (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    ShipmentYear INT NOT NULL,
    ShipmentMonth INT NOT NULL,
    Prod_Group NVARCHAR(100),
    Uncompleted_QTY DECIMAL(10,2),
    Delay INT,
    Customer_ID NVARCHAR(50),
    Order_Date DATE,
    Created_At DATETIME DEFAULT GETDATE()
);
GO

-- Вставка тестовых данных
INSERT INTO dbo.Uncompleted_Orders (ShipmentYear, ShipmentMonth, Prod_Group, Uncompleted_QTY, Customer_ID, Order_Date)
VALUES 
    (2024, 12, 'Electronics', 150.5, 'CUST001', '2024-12-01'),
    (2024, 12, 'Clothing', 200.0, 'CUST002', '2024-12-02'),
    (2024, 11, 'Electronics', 75.25, 'CUST003', '2024-11-15');
GO
```

### Настройка переменных окружения

#### Файл `.env` (Back/BIG_STATISTICS/.env)
```env
# Database Configuration
DB_SERVER=localhost
DB_NAME=BigStatistics
DB_USER=sa
DB_PASSWORD=your_secure_password

# Application Configuration
FLASK_ENV=development
FLASK_DEBUG=true
FLASK_PORT=5000

# CORS Configuration
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

### Настройка Frontend

#### Конфигурация Vite (vite.config.ts)
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})
```

#### Конфигурация Tailwind CSS (tailwind.config.js)
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

## 🚀 Запуск приложения

### Запуск Backend
```bash
cd Back
.\.venv\Scripts\Activate.ps1  # Активация виртуального окружения
cd BIG_STATISTICS
python Run_Server.py
```

**Ожидаемый вывод:**
```
 * Serving Flask app 'Run_Server'
 * Debug mode: on
 * Running on http://127.0.0.1:5000
```

### Запуск Frontend
```bash
cd Front/big-statistics-dashboard
npm run dev
```

**Ожидаемый вывод:**
```
  VITE v7.0.0  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### Проверка работы
1. Откройте браузер и перейдите на `http://localhost:5173`
2. Проверьте, что сайдбар отображается корректно
3. Перейдите в раздел "Незавершенные заказы"
4. Убедитесь, что данные загружаются из API

## 🔍 Диагностика проблем

### Проблемы с Backend

#### Ошибка подключения к БД
```
RuntimeError: Ошибка подключения к базе данных: ('01000', "[01000] unixODBC configuration error; ...")
```

**Решение:**
1. Проверьте правильность параметров в `.env` файле
2. Убедитесь, что SQL Server запущен
3. Проверьте, что ODBC Driver установлен
4. Проверьте права доступа пользователя к БД

#### Ошибка импорта модулей
```
ModuleNotFoundError: No module named 'flask'
```

**Решение:**
1. Убедитесь, что виртуальное окружение активировано
2. Переустановите зависимости: `pip install -r requirements.txt`

### Проблемы с Frontend

#### Ошибка сборки
```
Error: Cannot find module 'react'
```

**Решение:**
1. Удалите папку `node_modules`
2. Удалите файл `package-lock.json`
3. Выполните `npm install`

#### Ошибка CORS
```
Access to fetch at 'http://localhost:5000/api/...' from origin 'http://localhost:5173' has been blocked by CORS policy
```

**Решение:**
1. Убедитесь, что backend запущен на порту 5000
2. Проверьте настройки CORS в `Run_Server.py`
3. Проверьте proxy настройки в `vite.config.ts`

### Проблемы с базой данных

#### Ошибка аутентификации
```
Login failed for user 'sa'
```

**Решение:**
1. Проверьте правильность пароля в `.env`
2. Убедитесь, что SQL Server настроен для смешанной аутентификации
3. Проверьте, что пользователь `sa` активен

#### Ошибка доступа к таблице
```
Invalid object name 'dbo.Uncompleted_Orders'
```

**Решение:**
1. Убедитесь, что таблица создана в правильной базе данных
2. Проверьте права доступа пользователя к таблице
3. Проверьте схему таблицы: `SELECT * FROM INFORMATION_SCHEMA.TABLES`

## 📊 Мониторинг и логи

### Backend логи
```bash
# Запуск с подробными логами
python Run_Server.py --debug

# Просмотр логов в реальном времени
tail -f logs/app.log
```

### Frontend логи
```bash
# Запуск с подробными логами
npm run dev -- --debug

# Просмотр логов в браузере
F12 → Console
```

### Проверка API
```bash
# Тестирование API endpoints
curl http://localhost:5000/api/uncompleted-orders/table
curl http://localhost:5000/api/uncompleted-orders/views
```

## 🔧 Дополнительные настройки

### Настройка для продакшена

#### Backend (Production)
```bash
# Установка production зависимостей
pip install gunicorn

# Запуск production сервера
gunicorn -w 4 -b 0.0.0.0:5000 Run_Server:app
```

#### Frontend (Production)
```bash
# Сборка для продакшена
npm run build

# Запуск production сервера
npx serve -s dist -l 3000
```

### Настройка HTTPS
```bash
# Генерация SSL сертификата
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Запуск с HTTPS
gunicorn -w 4 -b 0.0.0.0:5000 --certfile=cert.pem --keyfile=key.pem Run_Server:app
```

### Настройка Docker
```dockerfile
# Dockerfile для Backend
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["python", "Run_Server.py"]
```

## 📞 Поддержка

### Полезные команды
```bash
# Проверка версий
python --version
node --version
npm --version

# Проверка установленных пакетов
pip list
npm list

# Очистка кэша
pip cache purge
npm cache clean --force

# Обновление зависимостей
pip install --upgrade -r requirements.txt
npm update
```

### Контакты для поддержки
- **Документация**: См. файлы `PROJECT_DESCRIPTION.md` и `TECHNICAL_DOCUMENTATION.md`
- **Issues**: Создавайте issues в репозитории проекта
- **Логи**: Проверяйте логи приложения для диагностики проблем 