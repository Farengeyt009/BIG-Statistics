# BIG STATISTICS

Система для анализа и управления статистическими данными с веб-интерфейсом.

## Структура проекта

```
BIG_STATISTICS/
├── Back/                          # Backend (Python/FastAPI)
│   ├── __init__.py
│   ├── config.py                  # Конфигурация приложения
│   ├── database/
│   │   ├── __init__.py
│   │   └── db_connector.py        # Подключение к базе данных
│   ├── orders/
│   │   ├── __init__.py
│   │   ├── api/                   # API endpoints
│   │   │   ├── __init__.py
│   │   │   ├── CustomerOrdersInformation_table.py
│   │   │   └── CustomerOrdersInformation_views.py
│   │   ├── repository/            # Слой доступа к данным
│   │   └── service/               # Бизнес-логика
│   │       ├── __init__.py
│   │       ├── CustomerOrdersInformation_table.py
│   │       └── CustomerOrdersInformation_views.py
│   ├── requirements.txt           # Python зависимости
│   └── Run_Server.py              # Точка входа сервера
├── Front/                         # Frontend (React/TypeScript)
│   ├── big-statistics-dashboard/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── sidebar/       # Компоненты боковой панели
│   │   │   │   │   ├── Sidebar.tsx
│   │   │   │   │   ├── SidebarIcon.tsx
│   │   │   │   │   ├── sidebarTranslation.json
│   │   │   │   │   └── sidebar.d.ts
│   │   │   │   ├── DataTable/     # Компоненты таблиц
│   │   │   │   │   ├── DataTable.tsx
│   │   │   │   │   ├── FilterPopover.tsx
│   │   │   │   │   ├── dataTableTranslation.json
│   │   │   │   │   └── index.ts
│   │   │   │   ├── LanguageSwitcher.tsx
│   │   │   │   └── PageHeaderWithTabs.tsx
│   │   │   ├── pages/
│   │   │   │   └── Orders/
│   │   │   │       ├── CustomTableBuilder.tsx
│   │   │   │       ├── fieldGroups.ts
│   │   │   │       ├── FieldsSelectorPopover.tsx
│   │   │   │       ├── ordersTranslation.json
│   │   │   │       ├── UncompletedOrdersTable.tsx
│   │   │   │       └── utils/
│   │   │   │           ├── groupAndAggregate.ts
│   │   │   │           └── numericFields.ts
│   │   │   ├── assets/
│   │   │   │   ├── chart.png
│   │   │   │   └── logo_big_statistics.png
│   │   │   ├── Test/
│   │   │   │   └── uncompleted_orders.json
│   │   │   ├── App.tsx
│   │   │   ├── i18n.ts
│   │   │   └── main.tsx
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── tailwind.config.js
│   ├── package.json
│   └── package-lock.json
├── alembic.ini                    # Конфигурация миграций БД
├── requirements.txt               # Общие зависимости
└── FRONTEND_ARCHITECTURE.md      # Архитектура фронтенда
```

## Технологии

### Backend
- **Python 3.8+**
- **FastAPI** - веб-фреймворк
- **SQLAlchemy** - ORM
- **Alembic** - миграции базы данных
- **PostgreSQL** - база данных

### Frontend
- **React 18** - UI библиотека
- **TypeScript** - типизированный JavaScript
- **Vite** - сборщик
- **Tailwind CSS** - CSS фреймворк
- **Framer Motion** - анимации
- **React Router** - маршрутизация
- **React i18next** - интернационализация
- **TanStack Table** - таблицы
- **DND Kit** - drag & drop

## Установка и запуск

### Backend
```bash
cd Back
pip install -r requirements.txt
python Run_Server.py
```

### Frontend
```bash
cd Front/big-statistics-dashboard
npm install
npm run dev
```

## Основные функции

- 📊 **Анализ заказов** - просмотр и анализ незавершенных заказов
- 🎛️ **Кастомные таблицы** - настройка отображения данных
- 🌐 **Мультиязычность** - поддержка русского, английского и китайского языков
- 📱 **Адаптивный дизайн** - работает на всех устройствах
- 🔄 **Drag & Drop** - изменение порядка столбцов
- 🔍 **Фильтрация** - фильтрация данных по столбцам

## Архитектура

Подробное описание архитектуры фронтенда см. в [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md) 