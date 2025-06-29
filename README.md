# BIG-Statistics

Проект для анализа больших статистических данных с веб-интерфейсом.

## 🏗️ Основные принципы архитектуры

### Backend (папка Back)
- **Каждая папка отвечает за возврат данных определённой группы.**
  - Например, папка `orders` отвечает за все данные, связанные с заказами (логика, API, сервисы, репозитории).
  - В будущем появятся новые папки (например, `plan` — для возврата планов, и т.д.).
- **Внутри каждой группы:**
  - `api/` — роуты (endpoints) для этой группы данных
  - `service/` — бизнес-логика
  - `repository/` — доступ к данным (слой работы с БД)
- **Общие модули** (например, папка `core`) будут добавляться для общей логики, используемой в разных частях проекта.

### Frontend (папка Front/big-statistics-dashboard/src)
- **pages/** — каждая папка внутри соответствует отдельной странице приложения.
  - Внутри страницы могут быть свои утилиты (`utils/`), специфичные для этой страницы.
- **components/** — общие переиспользуемые компоненты, которые можно использовать на разных страницах.
- **assets/** — статические файлы (картинки, иконки и т.д.).
- **utils/** — общие утилиты (если появятся, на уровне всего приложения).

## 🗂️ Структура проекта

```
BIG_STATISTICS/
├── Back/
│   ├── orders/
│   │   ├── api/
│   │   ├── service/
│   │   ├── repository/
│   │   └── __init__.py
│   ├── plan/ (пример для будущих сущностей)
│   ├── database/
│   ├── config.py
│   ├── Run_Server.py
│   └── requirements.txt
├── Front/
│   └── big-statistics-dashboard/
│       ├── src/
│       │   ├── pages/
│       │   │   └── Orders/
│       │   │       ├── utils/
│       │   │       ├── CustomTableBuilder.tsx
│       │   │       └── ...
│       │   ├── components/
│       │   │   ├── DataTable/
│       │   │   └── ...
│       │   ├── assets/
│       │   └── ...
│       ├── public/
│       └── package.json
├── requirements.txt
├── alembic.ini
└── README.md
```

## 🚀 Быстрый старт

### Backend (Python/Flask)

```bash
cd Back
pip install -r requirements.txt
# .env с переменными подключения к БД
python Run_Server.py
```

### Frontend (React/TypeScript)

```bash
cd Front/big-statistics-dashboard
npm install
npm run dev
```

## 📊 API Endpoints (пример)

- **GET** `/api/CustomerOrdersInformation/views` — Данные для графиков и аналитики
- **GET** `/api/CustomerOrdersInformation/table` — Полные данные для таблицы

## 🛠️ Технологии

- **Backend:** Python, Flask, Flask-CORS, PyODBC, SQLAlchemy, Python-dotenv, Cachetools
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router, Chart.js
- **База данных:** Microsoft SQL Server, ODBC Driver 18

## 🔧 Конфигурация

**.env (пример):**
```
DB_SERVER=your_server_ip
DB_NAME=your_database_name
DB_USER=your_username
DB_PASSWORD=your_password
```

## 📝 Разработка

- Для новой бизнес-сущности создайте новую папку в Back (например, `plan`) и реализуйте там api, service, repository.
- Для новой страницы на фронте — создайте папку в `src/pages/`, используйте/создавайте компоненты в `src/components/`.

## 🚀 Деплой

- Backend: `gunicorn -w 4 -b 0.0.0.0:5000 Back.Run_Server:app`
- Frontend: `npm run build`

## 📄 Лицензия

MIT License 