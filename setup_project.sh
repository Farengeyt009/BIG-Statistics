#!/bin/bash

# ===========================================
# Скрипт настройки BIG STATISTICS проекта
# ===========================================

echo "🔧 Настройка BIG STATISTICS проекта..."
echo "======================================"

# Проверяем, что мы в правильной директории
if [ ! -f "Back/Run_Server.py" ]; then
    echo "❌ Ошибка: Back/Run_Server.py не найден"
    echo "Убедитесь, что вы находитесь в корневой папке проекта"
    exit 1
fi

# ===========================================
# 1. Настройка Python окружения
# ===========================================
echo "🐍 Настройка Python окружения..."

# Создаем виртуальное окружение
cd Back
python3 -m venv venv
source venv/bin/activate

# Устанавливаем зависимости
echo "📦 Установка Python зависимостей..."
pip install --upgrade pip
pip install -r requirements.txt

echo "✅ Python окружение настроено"

# ===========================================
# 2. Настройка Node.js окружения
# ===========================================
echo "📦 Настройка Node.js окружения..."

cd ../Front/big-statistics-dashboard

# Проверяем, есть ли node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 Установка Node.js зависимостей..."
    npm install
else
    echo "ℹ️ node_modules уже существует"
fi

echo "✅ Node.js окружение настроено"

# ===========================================
# 3. Создание .env файла
# ===========================================
echo "⚙️ Создание .env файла..."

cd ../../Back

if [ ! -f ".env" ]; then
    echo "📝 Создание .env файла..."
    cat > .env << 'EOF'
# ===== БАЗА ДАННЫХ =====
DB_SERVER=your-server-address
DB_NAME=your-database-name
DB_USER=your-username
DB_PASSWORD=your-password

# ===== FLASK НАСТРОЙКИ =====
FLASK_ENV=production
FLASK_DEBUG=False
SECRET_KEY=your-super-secret-key-here

# ===== ПОРТЫ =====
BACKEND_PORT=5000
FRONTEND_PORT=3000

# ===== ДОМЕН =====
DOMAIN=your-domain.com
ALLOWED_HOSTS=your-domain.com,localhost

# ===== CORS =====
CORS_ORIGINS=http://localhost:3000,https://your-domain.com
EOF

    echo "⚠️ ВНИМАНИЕ: Отредактируйте .env файл с вашими настройками БД!"
    echo "Файл: Back/.env"
else
    echo "ℹ️ .env файл уже существует"
fi

# ===========================================
# 4. Создание скрипта запуска
# ===========================================
echo "🚀 Создание скрипта запуска..."

cd ..

cat > start_dev.sh << 'EOF'
#!/bin/bash

echo "🚀 Запуск BIG STATISTICS в режиме разработки..."

# Активируем виртуальное окружение
cd Back
source venv/bin/activate

# Запускаем backend
echo "📡 Запуск backend (Flask)..."
python Run_Server.py &
BACKEND_PID=$!

# Ждем запуска backend
echo "⏳ Ожидание запуска backend..."
sleep 3

# Проверяем, что backend запустился
if ! curl -s http://localhost:5000 > /dev/null; then
    echo "❌ Backend не запустился"
    exit 1
fi

echo "✅ Backend запущен на http://localhost:5000"

# Запускаем frontend
echo "🌐 Запуск frontend (React)..."
cd ../Front/big-statistics-dashboard
npm run dev &
FRONTEND_PID=$!

echo "✅ Frontend запущен на http://localhost:3000"
echo ""
echo "🎉 BIG STATISTICS запущен!"
echo "Backend:  http://localhost:5000"
echo "Frontend: http://localhost:3000"
echo ""
echo "Для остановки нажмите Ctrl+C"

# Ждем сигнала завершения
trap "echo '🛑 Остановка сервисов...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
EOF

chmod +x start_dev.sh
echo "✅ Скрипт запуска создан: start_dev.sh"

# ===========================================
# 5. Создание production скрипта
# ===========================================
echo "🏭 Создание production скрипта..."

cat > start_prod.sh << 'EOF'
#!/bin/bash

echo "🏭 Запуск BIG STATISTICS в production режиме..."

# Активируем виртуальное окружение
cd Back
source venv/bin/activate

# Запускаем backend
echo "📡 Запуск backend..."
python Run_Server.py &
BACKEND_PID=$!

# Ждем запуска backend
sleep 3

# Собираем frontend
echo "🔨 Сборка frontend..."
cd ../Front/big-statistics-dashboard
npm run build

# Запускаем статический сервер для frontend
echo "🌐 Запуск статического сервера..."
npx serve -s dist -l 3000 &
FRONTEND_PID=$!

echo "✅ BIG STATISTICS запущен в production режиме!"
echo "Backend:  http://localhost:5000"
echo "Frontend: http://localhost:3000"

# Ждем сигнала завершения
trap "echo '🛑 Остановка сервисов...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
EOF

chmod +x start_prod.sh
echo "✅ Production скрипт создан: start_prod.sh"

# ===========================================
# 6. Создание инструкции
# ===========================================
echo "📖 Создание инструкции..."

cat > README_SETUP.md << 'EOF'
# BIG STATISTICS - Инструкция по настройке

## 🚀 Быстрый запуск:

### Режим разработки:
```bash
./start_dev.sh
```

### Production режим:
```bash
./start_prod.sh
```

## ⚙️ Настройка:

### 1. Настройка базы данных:
Отредактируйте файл `Back/.env`:
```env
DB_SERVER=your-server-address
DB_NAME=your-database-name
DB_USER=your-username
DB_PASSWORD=your-password
```

### 2. Проверка подключения:
```bash
cd Back
source venv/bin/activate
python -c "from database.db_connector import get_connection; print('✅ Подключение к БД успешно')"
```

### 3. Тестирование API:
```bash
curl http://localhost:5000/api/Home/Production
```

## 📁 Структура проекта:
```
BIG_STATISTICS/
├── Back/                           # Python backend
│   ├── venv/                      # Виртуальное окружение
│   ├── .env                       # Настройки БД
│   ├── Run_Server.py              # Главный файл
│   └── requirements.txt            # Python зависимости
├── Front/                         # React frontend
│   └── big-statistics-dashboard/
│       ├── node_modules/          # Node.js зависимости
│       ├── package.json           # Зависимости
│       └── src/                   # Исходный код
├── start_dev.sh                   # Запуск в dev режиме
├── start_prod.sh                  # Запуск в production
└── README_SETUP.md                # Эта инструкция
```

## 🔧 Полезные команды:

### Backend:
```bash
cd Back
source venv/bin/activate
python Run_Server.py
```

### Frontend:
```bash
cd Front/big-statistics-dashboard
npm run dev
```

### Установка зависимостей:
```bash
# Python
cd Back
source venv/bin/activate
pip install -r requirements.txt

# Node.js
cd Front/big-statistics-dashboard
npm install
```

## 🐛 Отладка:

### Проверка логов backend:
```bash
cd Back
source venv/bin/activate
python Run_Server.py
```

### Проверка логов frontend:
```bash
cd Front/big-statistics-dashboard
npm run dev
```

### Проверка подключения к БД:
```bash
cd Back
source venv/bin/activate
python -c "
from database.db_connector import get_connection
conn = get_connection()
print('✅ Подключение успешно')
conn.close()
"
```

## 🚀 Готово к работе!
EOF

echo "✅ Инструкция создана: README_SETUP.md"

# ===========================================
# Завершение
# ===========================================
echo ""
echo "🎉 Настройка проекта завершена!"
echo "======================================"
echo "📋 Что нужно сделать:"
echo "1. Отредактируйте Back/.env с настройками БД"
echo "2. Запустите: ./start_dev.sh"
echo ""
echo "📖 Подробная инструкция: README_SETUP.md"
echo "🚀 Готово к работе!" 