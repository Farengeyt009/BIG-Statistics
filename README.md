# BIG-Statistics

Проект для анализа больших статистических данных с веб-интерфейсом.

## 🏗️ Структура проекта

```
BIG_STATISTICS/
├── Back/                    # Python Flask backend
│   ├── orders/
│   │   ├── api/             # API endpoints (CustomerOrdersInformation)
│   │   │   ├── CustomerOrdersInformation_views.py
│   │   │   └── CustomerOrdersInformation_table.py
│   │   ├── service/         # Бизнес-логика
│   │   │   ├── CustomerOrdersInformation_views.py
│   │   │   └── CustomerOrdersInformation_table.py
│   │   ├── repository/      # (зарезервировано под слой данных)
│   │   └── __init__.py
│   ├── database/            # Подключение к БД
│   │   └── db_connector.py
│   ├── config.py            # Конфигурация
│   ├── Run_Server.py        # Точка входа
│   └── requirements.txt     # Python зависимости
├── Front/                   # React TypeScript frontend
│   └── big-statistics-dashboard/
│       ├── src/
│       │   ├── components/  # React компоненты
│       │   ├── pages/       # Страницы приложения
│       │   └── assets/      # Статические файлы
│       ├── public/
│       └── package.json
├── requirements.txt         # Основные Python зависимости
├── alembic.ini              # Конфигурация миграций
└── README.md
```

## 🚀 Быстрый старт

### Backend (Python/Flask)

```bash
# Установка зависимостей
cd Back
pip install -r requirements.txt

# Настройка переменных окружения
# Создайте файл .env в корне проекта:
DB_SERVER=your_server_ip
DB_NAME=your_database_name
DB_USER=your_username
DB_PASSWORD=your_password

# Запуск сервера
python Run_Server.py
```

Сервер запустится на `http://127.0.0.1:5000`

### Frontend (React/TypeScript)

```bash
# Установка зависимостей
cd Front/big-statistics-dashboard
npm install

# Запуск в режиме разработки
npm run dev
```

Приложение запустится на `http://localhost:5173`

## 📊 API Endpoints

### Информация о заказах клиента

- **GET** `/api/CustomerOrdersInformation/views` — Данные для графиков и аналитики
- **GET** `/api/CustomerOrdersInformation/table` — Полные данные для таблицы

### Пример ответа `/api/CustomerOrdersInformation/views`:

```json
{
  "data": [
    {
      "year": 2024,
      "month": 1,
      "Prod_Group": "Electronics",
      "Total_Uncompleted_QTY": 150.5
    }
  ],
  "total_by_month": {
    "2024-01": 150.5,
    "2024-02": 200.3
  },
  "grand_total": 350.8,
  "total_overdue_orders": 42
}
```

## 🛠️ Технологии

### Backend
- **Python 3.11+**
- **Flask 3.1.1** — Веб-фреймворк
- **Flask-CORS 6.0.1** — CORS поддержка
- **PyODBC 5.2.0** — Подключение к SQL Server
- **SQLAlchemy 2.0.41** — ORM
- **Python-dotenv 1.1.0** — Переменные окружения
- **Cachetools** — Кэширование данных

### Frontend
- **React 18** — UI библиотека
- **TypeScript** — Типизация
- **Vite** — Сборщик
- **Tailwind CSS** — Стилизация
- **React Router** — Маршрутизация
- **Chart.js** — Графики

### База данных
- **Microsoft SQL Server** — Основная БД
- **ODBC Driver 18** — Драйвер подключения

## 🔧 Конфигурация

### Переменные окружения (.env)

```env
DB_SERVER=your_server_ip
DB_NAME=your_database_name
DB_USER=your_username
DB_PASSWORD=your_password
```

### Структура базы данных

Основная таблица: `dbo.CustomerOrdersInformation` (или аналогичная, см. код)

## 📝 Разработка

### Добавление новых API endpoints

1. Создайте новый файл в `Back/orders/api/`
2. Добавьте сервис в `Back/orders/service/`
3. Зарегистрируйте blueprint в `Run_Server.py`

### Добавление новых компонентов

1. Создайте компонент в `Front/big-statistics-dashboard/src/components/`
2. Добавьте страницу в `Front/big-statistics-dashboard/src/pages/`
3. Обновите маршрутизацию

## 🚀 Деплой

### Backend
```bash
# Продакшн сервер
gunicorn -w 4 -b 0.0.0.0:5000 Back.Run_Server:app
```

### Frontend
```bash
# Сборка для продакшна
npm run build
```

## 📄 Лицензия

MIT License 