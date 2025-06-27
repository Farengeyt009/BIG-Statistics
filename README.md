# BIG-Statistics

Проект для анализа больших статистических данных с веб-интерфейсом.

## 🏗️ Структура проекта

```
BIG_STATISTICS/
├── backend/                 # Python FastAPI backend
│   ├── app/
│   │   ├── api/v1/         # API endpoints
│   │   ├── core/           # Настройки и БД
│   │   ├── repositories/   # Работа с данными
│   │   ├── services/       # Бизнес-логика
│   │   └── main.py         # Точка входа
│   └── requirements.txt
├── Front/                   # React TypeScript frontend
│   └── big-statistics-dashboard/
│       ├── src/
│       ├── public/
│       └── package.json
├── pyproject.toml          # Python зависимости
└── README.md
```

## 🚀 Быстрый старт

### Backend (Python/FastAPI)

```bash
# Установка зависимостей
poetry install

# Запуск сервера
cd backend
uvicorn app.main:app --reload
```

### Frontend (React/TypeScript)

```bash
# Установка зависимостей
cd Front/big-statistics-dashboard
npm install

# Запуск в режиме разработки
npm start
```

## 🛠️ Технологии

- **Backend**: Python, FastAPI, SQLAlchemy
- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **База данных**: PostgreSQL/SQLite
- **Управление зависимостями**: Poetry (Python), npm (Node.js)

## 📝 Лицензия

MIT License 