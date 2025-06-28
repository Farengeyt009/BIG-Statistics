# Архитектура Frontend (React/TypeScript)

## Основные принципы структуры

- **pages/** — каждая папка внутри соответствует отдельной странице приложения (например, Orders).
  - Внутри страницы могут быть свои утилиты (`utils/`), специфичные для этой страницы.
  - Все бизнес-компоненты, относящиеся только к этой странице, хранятся здесь же.
- **components/** — общие переиспользуемые компоненты, которые можно использовать на разных страницах (например, DataTable, Sidebar, PageHeaderWithTabs).
- **assets/** — статические файлы (картинки, иконки и т.д.).
- **utils/** — общие утилиты (если появятся, на уровне всего приложения).

## Структура src

```
src/
├── App.tsx                # Точка входа, роутинг
├── main.tsx               # Bootstrap приложения
├── i18n.ts                # Локализация
├── index.css, App.css     # Стили
├── assets/                # Картинки, иконки
├── components/            # Общие компоненты
│   ├── DataTable/
│   │   ├── DataTable.tsx
│   │   ├── FilterPopover.tsx
│   │   ├── ColumnToggle.tsx
│   │   └── ...
│   ├── Sidebar.tsx
│   ├── SidebarIcon.tsx
│   ├── PageHeaderWithTabs.tsx
│   └── ...
├── pages/
│   └── Orders/
│       ├── UncompletedOrdersTable.tsx
│       ├── CustomTableBuilder.tsx
│       ├── FieldsSelectorPopover.tsx
│       ├── fieldGroups.ts
│       ├── ordersTranslation.json
│       ├── utils/
│       │   ├── groupAndAggregate.ts
│       │   └── numericFields.ts
│       └── ...
└── ...
```

## Связи файлов (на примере Orders)

- **App.tsx**
  - Настраивает роутинг через `react-router-dom`.
  - Подключает Sidebar и рендерит страницу `/uncompleted-orders` через компонент `UncompletedOrdersTable`.

- **pages/Orders/UncompletedOrdersTable.tsx**
  - Основная страница заказов.
  - Использует:
    - `CustomTableBuilder` (для кастомных таблиц)
    - `FieldsSelectorPopover` (для выбора полей)
    - `PageHeaderWithTabs` (шапка с табами)
    - Утилиты из `utils/` (например, для агрегации данных)
    - Локализацию через `ordersTranslation.json`

- **pages/Orders/CustomTableBuilder.tsx**
  - Использует:
    - `DataTable` (общий компонент)
    - `groupAndAggregate` (утилита для агрегации)
    - `numericFields` (список числовых полей)
    - `fieldGroups` (группы полей для отображения)

- **components/DataTable/**
  - `DataTable.tsx` — универсальный компонент таблицы
  - `FilterPopover.tsx` — фильтрация данных
  - `ColumnToggle.tsx` — управление видимостью колонок

- **components/Sidebar.tsx**
  - Боковое меню, используется во всём приложении

- **components/PageHeaderWithTabs.tsx**
  - Заголовок страницы с табами

## Принципы расширения

- Для новой страницы создайте папку в `pages/`, добавьте нужные компоненты и утилиты.
- Для общего компонента — добавьте в `components/`.
- Для утилит, специфичных для страницы — используйте `pages/ИмяСтраницы/utils/`.
- Для общих утилит — создайте `src/utils/`.
- Для локализации — используйте отдельные json-файлы рядом со страницей или компонентом.

## Локализация
- Используется i18n (см. `i18n.ts`), переводы хранятся в json-файлах рядом со страницами/компонентами.

## Тестирование
- Тесты располагаются в `src/App.test.tsx`, `src/setupTests.ts` и могут быть добавлены рядом с компонентами.

## Стилизация
- Используется Tailwind CSS (см. `tailwind.config.js`).
- Глобальные стили — в `index.css`, `App.css`.

## Пример добавления новой страницы
1. Создайте папку в `src/pages/` (например, `Plan/`).
2. Реализуйте компонент страницы (например, `PlanTable.tsx`).
3. Добавьте утилиты в `pages/Plan/utils/` при необходимости.
4. Добавьте маршрут в `App.tsx`.
5. Используйте общие компоненты из `components/`.

---

**Этот файл — подробное описание архитектуры фронта. Для backend см. README.md.** 