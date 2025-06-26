# BIG_STATISTICS - Dashboard для анализа больших данных

## Описание проекта

BIG_STATISTICS - это веб-приложение для анализа и визуализации больших данных, состоящее из:
- **Backend**: Flask API с подключением к базе данных
- **Frontend**: React приложение с современным UI

## Структура проекта

```
BIG_STATISTICS/
├── Back/                    # Backend (Flask)
│   └── BIG_STATISTICS/
│       ├── routes/         # API маршруты
│       ├── services/       # Бизнес-логика
│       ├── database/       # Подключение к БД
│       └── Run_Server.py   # Запуск сервера
├── Front/                   # Frontend (React)
│   └── big-statistics-dashboard/
│       ├── src/
│       ├── components/
│       └── pages/
└── .venv/                   # Виртуальная среда Python
```

## Быстрый старт

### 1. Настройка виртуальной среды

```powershell
# Создание виртуальной среды
python -m venv .venv

# Активация (Windows PowerShell)
.\.venv\Scripts\Activate.ps1

# Установка зависимостей
cd Back\BIG_STATISTICS
pip install -r requirements.txt
```

### 2. Настройка конфигурации

```powershell
# Скопируйте пример конфигурации
copy config.example .env

# Отредактируйте .env файл с вашими данными
notepad .env
```

### 3. Запуск сервера

```powershell
# Убедитесь, что виртуальная среда активирована
cd Back\BIG_STATISTICS
python Run_Server.py
```

Сервер будет доступен по адресу: http://127.0.0.1:5000/

## Безопасность

⚠️ **ВАЖНО**: Файл `.env` содержит секретные данные и НЕ передается в Git!
- Все файлы с секретами добавлены в `.gitignore`
- Используйте `config.example` как шаблон для создания `.env`

## Технологии

### Backend
- **Flask** - веб-фреймворк
- **Flask-CORS** - поддержка CORS
- **pyodbc** - подключение к SQL Server
- **python-dotenv** - управление переменными окружения

### Frontend
- **React** - UI библиотека
- **TypeScript** - типизированный JavaScript
- **Tailwind CSS** - стилизация
- **Vite** - сборщик

## Разработка

### Структура версий
- `main` - стабильная версия
- `develop` - версия в разработке
- `feature/*` - новые функции

### Коммиты
Используйте понятные сообщения коммитов:
```
feat: добавлена новая таблица статистики
fix: исправлена ошибка в API
docs: обновлена документация
```

## Лицензия

MIT License

## 📋 Возможности

### ✅ Реализовано
- 📊 **Интерактивная таблица** незавершенных заказов
- 🔍 **Фильтрация и сортировка** данных
- 📈 **Агрегированная статистика** по месяцам и группам продуктов
- 🌐 **Многоязычная поддержка** (русский/английский)
- 🎨 **Адаптивный дизайн** с анимированным сайдбаром
- ⚡ **Кэширование** данных на backend'е
- 📤 **Экспорт данных** в CSV формате
- 🔧 **Выбор отображаемых колонок**

### 🔮 Планируется
- 📱 Мобильное приложение
- 🔐 Система авторизации
- 📊 Расширенная аналитика с графиками
- 🔔 Система уведомлений
- 🐳 Docker контейнеризация
- 🔄 Реал-тайм обновления

## 🏗️ Архитектура

```
BIG_STATISTICS/
├── Back/                    # Flask API сервер
│   ├── BIG_STATISTICS/     # Основной код
│   ├── database/           # Подключение к SQL Server
│   ├── routes/             # API маршруты
│   ├── services/           # Бизнес-логика
│   └── .venv/              # Виртуальное окружение
└── Front/                  # React SPA
    └── big-statistics-dashboard/
        ├── src/            # Исходный код
        ├── components/     # Переиспользуемые компоненты
        └── pages/          # Страницы приложения
```

## 🔧 Технологии

### Backend
- **Python 3.8+** - основной язык
- **Flask** - веб-фреймворк
- **pyodbc** - подключение к SQL Server
- **cachetools** - кэширование
- **python-dotenv** - переменные окружения

### Frontend
- **React 19.1.0** - UI библиотека
- **TypeScript 5.8.3** - типизация
- **Vite 7.0.0** - сборщик
- **Tailwind CSS 3.4.1** - стилизация
- **Framer Motion 12.18.1** - анимации
- **React i18next** - интернационализация
- **TanStack React Table** - таблицы

### База данных
- **Microsoft SQL Server** - основная БД
- **ODBC Driver 18** - драйвер подключения

## 📚 Документация

- **[📖 Подробное описание проекта](PROJECT_DESCRIPTION.md)** - полная структура и взаимосвязи
- **[🔧 Техническая документация](TECHNICAL_DOCUMENTATION.md)** - API, архитектура, компоненты
- **[🚀 Инструкции по установке](SETUP_INSTRUCTIONS.md)** - пошаговая настройка

## 🔍 API Endpoints

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/uncompleted-orders/table` | GET | Все незавершенные заказы |
| `/api/uncompleted-orders/views` | GET | Агрегированная статистика |

## 🛠️ Разработка

### Структура проекта
```
src/
├── components/          # Переиспользуемые компоненты
│   ├── Sidebar.tsx     # Боковая панель навигации
│   ├── DataTable/      # Компоненты таблиц
│   └── LanguageSwitcher.tsx
├── pages/              # Страницы приложения
│   └── Orders/         # Страница заказов
└── assets/             # Статические ресурсы
```

### Команды разработки
```bash
# Backend
cd Back/BIG_STATISTICS
python Run_Server.py

# Frontend
cd Front/big-statistics-dashboard
npm run dev          # Разработка
npm run build        # Сборка
npm run preview      # Предпросмотр
```

## 🔍 Диагностика

### Проверка установки
```bash
# Backend
python Check\ pip.py

# Frontend
npm run dev
```

### Логи
- **Backend**: Консоль Flask сервера
- **Frontend**: Браузер F12 → Console
- **API**: curl http://localhost:5000/api/uncompleted-orders/table

## 🤝 Вклад в проект

1. Форкните репозиторий
2. Создайте ветку для новой функции
3. Внесите изменения
4. Создайте Pull Request

## 📞 Поддержка

- **Документация**: См. файлы документации в корне проекта
- **Issues**: Создавайте issues для багов и предложений
- **Вопросы**: Используйте Discussions для общих вопросов

---

**BIG_STATISTICS** - современная система аналитики для управления заказами 🚀 