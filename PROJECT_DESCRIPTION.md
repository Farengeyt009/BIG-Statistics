# BIG_STATISTICS - Система аналитики и управления заказами

## 📋 Обзор проекта

**BIG_STATISTICS** - это полнофункциональная система для анализа и управления незавершенными заказами, построенная на архитектуре **Frontend + Backend**. Проект предоставляет интерактивную панель управления с возможностью просмотра статистики, фильтрации данных и многоязычной поддержки.

## 🏗️ Архитектура проекта

Проект использует **микросервисную архитектуру** с разделением на:
- **Backend**: Flask API сервер с подключением к SQL Server
- **Frontend**: React SPA с TypeScript и Tailwind CSS
- **База данных**: Microsoft SQL Server

```
BIG_STATISTICS/
├── Back/                    # Backend сервер
│   ├── BIG_STATISTICS/     # Основной код бэкенда
│   ├── .venv/              # Виртуальное окружение Python
│   └── requirements.txt    # Зависимости Python
└── Front/                  # Frontend приложение
    └── big-statistics-dashboard/
        ├── src/            # Исходный код React
        └── package.json    # Зависимости Node.js
```

## 🔧 Backend (Python/Flask)

### Структура папки `Back/`

```
Back/
├── BIG_STATISTICS/                    # Основной модуль
│   ├── __init__.py                   # Инициализация пакета
│   ├── config.py                     # Конфигурация БД и переменных окружения
│   ├── Run_Server.py                 # Точка входа Flask приложения
│   ├── database/                     # Слой работы с базой данных
│   │   ├── __init__.py
│   │   └── db_connector.py           # Подключение к SQL Server
│   ├── routes/                       # API маршруты (Blueprint)
│   │   ├── __init__.py
│   │   ├── uncompleted_orders_table.py    # API для таблицы заказов
│   │   └── uncompleted_orders_views.py    # API для статистики
│   ├── services/                     # Бизнес-логика
│   │   ├── __init__.py
│   │   ├── uncompleted_orders_table.py    # Сервис таблицы заказов
│   │   └── uncompleted_orders_views.py    # Сервис статистики
│   └── requirements.txt              # Зависимости проекта
├── .venv/                           # Виртуальное окружение
├── Check pip.py                     # Скрипт проверки зависимостей
├── main.py                          # Тестовый файл PyCharm
└── requirements.txt                 # Основные зависимости
```

### Ключевые компоненты Backend

#### 1. **Конфигурация** (`config.py`)
- Загрузка переменных окружения из `.env` файла
- Настройка подключения к SQL Server через ODBC
- Параметры: сервер, база данных, пользователь, пароль

#### 2. **Подключение к БД** (`database/db_connector.py`)
- Использует `pyodbc` для подключения к SQL Server
- Обработка ошибок подключения
- Возвращает активное соединение для выполнения запросов

#### 3. **API Маршруты** (`routes/`)
- **`uncompleted_orders_table.py`**: `/api/uncompleted-orders/table` - получение всех незавершенных заказов
- **`uncompleted_orders_views.py`**: `/api/uncompleted-orders/views` - получение агрегированной статистики

#### 4. **Бизнес-логика** (`services/`)
- **`uncompleted_orders_table.py`**: 
  - Получение всех записей из таблицы `dbo.Uncompleted_Orders`
  - Кэширование результатов (TTL 60 секунд)
  - Преобразование типов данных (Decimal → float, даты → ISO формат)
  
- **`uncompleted_orders_views.py`**:
  - Агрегация данных по годам, месяцам и группам продуктов
  - Подсчет просроченных заказов
  - Расчет общих сумм по месяцам

#### 5. **Сервер** (`Run_Server.py`)
- Flask приложение с CORS поддержкой
- Регистрация Blueprint'ов для маршрутов
- Запуск в режиме отладки

### Зависимости Backend
```
asgiref==3.8.1          # ASGI утилиты
Django==5.2.1           # Django (возможно для будущего расширения)
pyodbc==5.2.0           # Подключение к SQL Server
sqlparse==0.5.3         # Парсинг SQL
tzdata==2025.2          # Часовые пояса
Flask                   # Веб-фреймворк
flask-cors              # CORS поддержка
python-dotenv           # Переменные окружения
cachetools              # Кэширование
```

## 🎨 Frontend (React/TypeScript)

### Структура папки `Front/big-statistics-dashboard/`

```
Front/big-statistics-dashboard/
├── src/                           # Исходный код
│   ├── App.tsx                   # Главный компонент приложения
│   ├── main.tsx                  # Точка входа React
│   ├── i18n.ts                   # Конфигурация интернационализации
│   ├── components/               # Переиспользуемые компоненты
│   │   ├── Sidebar.tsx           # Боковая панель навигации
│   │   ├── SidebarIcon.tsx       # Иконки сайдбара
│   │   ├── LanguageSwitcher.tsx  # Переключатель языков
│   │   ├── PageHeaderWithTabs.tsx # Заголовок страницы с табами
│   │   ├── DataTable/            # Компоненты таблиц
│   │   │   ├── DataTable.tsx     # Основная таблица
│   │   │   ├── ColumnToggle.tsx  # Переключатель колонок
│   │   │   ├── FilterPopover.tsx # Фильтры
│   │   │   └── dataTableTranslation.json
│   │   ├── sidebarTranslation.json # Переводы сайдбара
│   │   └── sidebar.d.ts          # Типы для сайдбара
│   ├── pages/                    # Страницы приложения
│   │   └── Orders/               # Страница заказов
│   │       ├── UncompletedOrdersTable.tsx # Основная таблица заказов
│   │       ├── CustomTableBuilder.tsx     # Построитель таблиц
│   │       ├── FieldsSelectorPopover.tsx  # Выбор полей
│   │       ├── fieldGroups.ts             # Группы полей
│   │       ├── ordersTranslation.json     # Переводы страницы
│   │       └── utils/                     # Утилиты
│   │           ├── groupAndAggregate.ts   # Группировка и агрегация
│   │           └── numericFields.ts       # Числовые поля
│   ├── assets/                   # Статические ресурсы
│   │   ├── logo_big_statistics.png
│   │   └── chart.png
│   └── Test/                     # Тестовые данные
│       └── uncompleted_orders.json
├── public/                       # Публичные файлы
├── package.json                  # Зависимости и скрипты
├── vite.config.ts               # Конфигурация Vite
├── tailwind.config.js           # Конфигурация Tailwind CSS
└── tsconfig.json                # Конфигурация TypeScript
```

### Ключевые компоненты Frontend

#### 1. **Главное приложение** (`App.tsx`)
- Роутинг с `react-router-dom`
- Управление состоянием сайдбара (expanded/collapsed)
- Сохранение состояния в localStorage
- Интеграция с сайдбаром и основным контентом

#### 2. **Сайдбар** (`components/Sidebar.tsx`)
- Анимированная боковая панель с использованием Framer Motion
- Трехфазная анимация (сворачивание/разворачивание)
- Навигация по разделам приложения
- Интеграция с LanguageSwitcher
- Tooltip'ы для иконок в свернутом состоянии

#### 3. **Таблица заказов** (`pages/Orders/UncompletedOrdersTable.tsx`)
- Основной компонент для отображения данных
- Интеграция с API backend'а
- Фильтрация, сортировка, группировка данных
- Выбор отображаемых колонок
- Экспорт данных

#### 4. **Интернационализация** (`i18n.ts`)
- Поддержка многоязычности через `react-i18next`
- Автоматическое определение языка браузера
- Переключение между языками в реальном времени

### Технологии Frontend
```
React 19.1.0              # Основной фреймворк
TypeScript 5.8.3          # Типизация
Vite 7.0.0                # Сборщик и dev-сервер
Tailwind CSS 3.4.1        # CSS фреймворк
Framer Motion 12.18.1     # Анимации
React Router DOM 7.6.2    # Роутинг
React i18next 15.5.3      # Интернационализация
TanStack React Table 8.21.3 # Таблицы
Radix UI                  # UI компоненты
Lucide React              # Иконки
```

## 🔄 Взаимосвязи компонентов

### Поток данных

```
Frontend (React) ←→ Backend (Flask) ←→ Database (SQL Server)
     ↓                    ↓                    ↓
  UI Components    API Endpoints        dbo.Uncompleted_Orders
     ↓                    ↓                    ↓
  State Management  Business Logic      Raw Data
     ↓                    ↓                    ↓
  User Interactions  Data Processing    Aggregated Views
```

### API Endpoints

| Endpoint | Метод | Описание | Возвращает |
|----------|-------|----------|------------|
| `/api/uncompleted-orders/table` | GET | Все незавершенные заказы | Массив объектов заказов |
| `/api/uncompleted-orders/views` | GET | Агрегированная статистика | Объект с данными и метриками |

### Компонентные связи

```
App.tsx
├── Sidebar.tsx
│   ├── SidebarIcon.tsx
│   └── LanguageSwitcher.tsx
└── UncompletedOrdersTable.tsx
    ├── CustomTableBuilder.tsx
    ├── FieldsSelectorPopover.tsx
    └── DataTable/
        ├── DataTable.tsx
        ├── ColumnToggle.tsx
        └── FilterPopover.tsx
```

## 🚀 Запуск проекта

### Backend
```bash
cd Back
.\.venv\Scripts\Activate.ps1  # Активация виртуального окружения
cd BIG_STATISTICS
python Run_Server.py          # Запуск Flask сервера
```

### Frontend
```bash
cd Front/big-statistics-dashboard
npm install                   # Установка зависимостей
npm run dev                   # Запуск dev-сервера
```

## 📊 Функциональность

### Основные возможности
1. **Просмотр незавершенных заказов** в табличном виде
2. **Фильтрация и сортировка** данных
3. **Группировка** по различным критериям
4. **Экспорт** данных
5. **Многоязычная поддержка** (русский/английский)
6. **Адаптивный дизайн** с анимированным сайдбаром
7. **Кэширование** данных на backend'е

### Статистика и аналитика
- Количество незавершенных заказов по месяцам
- Группировка по продуктам
- Подсчет просроченных заказов
- Общие суммы и метрики

## 🔧 Конфигурация

### Переменные окружения (`.env`)
```env
DB_SERVER=your_server_name
DB_NAME=your_database_name
DB_USER=your_username
DB_PASSWORD=your_password
```

### Настройки CORS
Backend настроен для принятия запросов с любого origin в режиме разработки.

## 📁 Структура базы данных

Основная таблица: `dbo.Uncompleted_Orders`
- Содержит информацию о незавершенных заказах
- Поля: ShipmentYear, ShipmentMonth, Prod_Group, Uncompleted_QTY, Delay и др.

## 🔮 Возможности расширения

1. **Добавление новых разделов** аналитики
2. **Интеграция с другими БД**
3. **Реал-тайм обновления** через WebSocket
4. **Расширенная аналитика** с графиками
5. **Система уведомлений**
6. **Пользовательские роли и права**

## 🛠️ Инструменты разработки

- **Backend**: PyCharm, Python 3.x, Flask
- **Frontend**: VS Code, Node.js, React DevTools
- **База данных**: SQL Server Management Studio
- **Версионирование**: Git
- **Сборка**: Vite, pip 