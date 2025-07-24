#!/bin/bash

# ===========================================
# Скрипт установки BIG STATISTICS на сервер
# ===========================================

echo "🚀 Начинаем установку BIG STATISTICS на сервер..."
echo "================================================"

# Проверяем, что скрипт запущен от root или с sudo
if [ "$EUID" -ne 0 ]; then
    echo "❌ Этот скрипт должен быть запущен с правами sudo"
    echo "Используйте: sudo bash install_server.sh"
    exit 1
fi

# ===========================================
# 1. Обновление системы
# ===========================================
echo "📦 Обновление системы..."
apt update && apt upgrade -y
echo "✅ Система обновлена"

# ===========================================
# 2. Установка Python
# ===========================================
echo "🐍 Установка Python..."
apt install python3 python3-pip python3-venv python3-dev -y

# Проверяем версию Python
python3 --version
echo "✅ Python установлен"

# ===========================================
# 3. Установка Node.js
# ===========================================
echo "📦 Установка Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Проверяем версию Node.js
node --version
npm --version
echo "✅ Node.js установлен"

# ===========================================
# 4. Установка ODBC драйвера для SQL Server
# ===========================================
echo "🗄️ Установка ODBC драйвера для SQL Server..."

# Добавляем репозиторий Microsoft
curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add -
curl https://packages.microsoft.com/config/ubuntu/20.04/prod.list > /etc/apt/sources.list.d/mssql-release.list

# Обновляем пакеты
apt update

# Устанавливаем ODBC драйвер
ACCEPT_EULA=Y apt-get install -y msodbcsql18
apt-get install -y unixodbc-dev

echo "✅ ODBC драйвер установлен"

# ===========================================
# 5. Установка VS Code
# ===========================================
echo "💻 Установка VS Code..."

# Добавляем ключ Microsoft
wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
install -o root -g root -m 644 packages.microsoft.gpg /etc/apt/trusted.gpg.d/

# Добавляем репозиторий VS Code
sh -c 'echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/trusted.gpg.d/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" > /etc/apt/sources.list.d/vscode.list'

# Обновляем и устанавливаем VS Code
apt update
apt install code -y

echo "✅ VS Code установлен"

# ===========================================
# 6. Установка дополнительных инструментов
# ===========================================
echo "🔧 Установка дополнительных инструментов..."
apt install git curl wget htop nano -y
echo "✅ Дополнительные инструменты установлены"

# ===========================================
# 7. Создание пользователя для приложения
# ===========================================
echo "👤 Создание пользователя для приложения..."
if ! id "bigstats" &>/dev/null; then
    useradd -m -s /bin/bash bigstats
    echo "bigstats:bigstats123" | chpasswd
    usermod -aG sudo bigstats
    echo "✅ Пользователь bigstats создан"
else
    echo "ℹ️ Пользователь bigstats уже существует"
fi

# ===========================================
# 8. Настройка рабочей директории
# ===========================================
echo "📁 Настройка рабочей директории..."
mkdir -p /opt/big-statistics
chown bigstats:bigstats /opt/big-statistics
echo "✅ Рабочая директория создана: /opt/big-statistics"

# ===========================================
# 9. Создание systemd сервиса для backend
# ===========================================
echo "🔧 Создание systemd сервиса для backend..."
cat > /etc/systemd/system/big-statistics-backend.service << EOF
[Unit]
Description=Big Statistics Backend
After=network.target

[Service]
Type=simple
User=bigstats
WorkingDirectory=/opt/big-statistics/Back
Environment=PATH=/opt/big-statistics/Back/venv/bin
ExecStart=/opt/big-statistics/Back/venv/bin/python Run_Server.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable big-statistics-backend
echo "✅ Systemd сервис создан"

# ===========================================
# 10. Создание скрипта запуска
# ===========================================
echo "📝 Создание скрипта запуска..."
cat > /opt/big-statistics/start.sh << 'EOF'
#!/bin/bash

echo "🚀 Запуск BIG STATISTICS..."

# Активируем виртуальное окружение
cd /opt/big-statistics/Back
source venv/bin/activate

# Запускаем backend
echo "📡 Запуск backend..."
python Run_Server.py &

# Ждем запуска backend
sleep 5

# Запускаем frontend
echo "🌐 Запуск frontend..."
cd /opt/big-statistics/Front/big-statistics-dashboard
npm run dev &

echo "✅ BIG STATISTICS запущен!"
echo "Backend: http://localhost:5000"
echo "Frontend: http://localhost:3000"
EOF

chmod +x /opt/big-statistics/start.sh
chown bigstats:bigstats /opt/big-statistics/start.sh
echo "✅ Скрипт запуска создан"

# ===========================================
# 11. Создание инструкции
# ===========================================
echo "📖 Создание инструкции..."
cat > /opt/big-statistics/README_SERVER.md << 'EOF'
# BIG STATISTICS - Инструкция по развертыванию

## 📋 Что установлено:
- Python 3.11+
- Node.js 18+
- ODBC Driver для SQL Server
- VS Code
- Systemd сервис для backend

## 🚀 Как запустить:

### Вариант 1: Автоматический запуск
```bash
sudo systemctl start big-statistics-backend
cd /opt/big-statistics/Front/big-statistics-dashboard
npm run dev
```

### Вариант 2: Ручной запуск
```bash
cd /opt/big-statistics
./start.sh
```

### Вариант 3: Через VS Code
1. Откройте VS Code: `code /opt/big-statistics`
2. Запустите Back/Run_Server.py
3. В терминале: `cd Front/big-statistics-dashboard && npm run dev`

## ⚙️ Настройка:
1. Скопируйте ваш проект в `/opt/big-statistics/`
2. Создайте `.env` файл в папке Back/
3. Установите Python зависимости: `pip install -r requirements.txt`
4. Установите Node.js зависимости: `npm install`

## 🔧 Полезные команды:
- Проверить статус backend: `sudo systemctl status big-statistics-backend`
- Перезапустить backend: `sudo systemctl restart big-statistics-backend`
- Посмотреть логи: `sudo journalctl -u big-statistics-backend -f`

## 📁 Структура:
```
/opt/big-statistics/
├── Back/                    # Python backend
├── Front/                   # React frontend
├── start.sh                 # Скрипт запуска
└── README_SERVER.md         # Эта инструкция
```
EOF

echo "✅ Инструкция создана: /opt/big-statistics/README_SERVER.md"

# ===========================================
# Завершение
# ===========================================
echo ""
echo "🎉 Установка завершена!"
echo "================================================"
echo "📋 Что нужно сделать дальше:"
echo "1. Скопируйте ваш проект в /opt/big-statistics/"
echo "2. Создайте .env файл с настройками БД"
echo "3. Установите Python зависимости: pip install -r requirements.txt"
echo "4. Установите Node.js зависимости: npm install"
echo "5. Запустите приложение: ./start.sh"
echo ""
echo "📖 Подробная инструкция: /opt/big-statistics/README_SERVER.md"
echo "👤 Пользователь: bigstats (пароль: bigstats123)"
echo "💻 VS Code: code /opt/big-statistics"
echo ""
echo "🚀 Готово к работе!" 