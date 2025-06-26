# Техническая документация BIG_STATISTICS

## 🔧 API Документация

### Backend API Endpoints

#### 1. Получение таблицы незавершенных заказов

**Endpoint:** `GET /api/uncompleted-orders/table`

**Описание:** Возвращает все записи из таблицы незавершенных заказов

**Ответ:**
```json
[
  {
    "ShipmentYear": 2024,
    "ShipmentMonth": 12,
    "Prod_Group": "Electronics",
    "Uncompleted_QTY": 150.5,
    "Delay": null,
    "Customer_ID": "CUST001",
    "Order_Date": "2024-12-01"
  }
]
```

**Особенности:**
- Кэширование на 60 секунд
- Автоматическое преобразование типов данных
- Обработка null значений

#### 2. Получение агрегированной статистики

**Endpoint:** `GET /api/uncompleted-orders/views`

**Описание:** Возвращает агрегированные данные по незавершенным заказам

**Ответ:**
```json
{
  "data": [
    {
      "year": 2024,
      "month": 12,
      "Prod_Group": "Electronics",
      "Total_Uncompleted_QTY": 150.5
    }
  ],
  "total_by_month": {
    "2024-12": 150.5,
    "2024-11": 200.0
  },
  "grand_total": 350.5,
  "total_overdue_orders": 25
}
```

**Поля ответа:**
- `data`: Массив агрегированных записей
- `total_by_month`: Суммы по месяцам (ключ: "YYYY-MM")
- `grand_total`: Общая сумма всех незавершенных заказов
- `total_overdue_orders`: Количество просроченных заказов

## 🏗️ Архитектурные решения

### Backend Architecture

#### Слой данных (Data Layer)
```python
# database/db_connector.py
def get_connection():
    # Создание подключения к SQL Server через pyodbc
    # Обработка ошибок подключения
    # Возврат активного соединения
```

**Принципы:**
- Единая точка подключения к БД
- Обработка ошибок на уровне подключения
- Использование переменных окружения для конфигурации

#### Слой сервисов (Service Layer)
```python
# services/uncompleted_orders_table.py
@cached(TTLCache(maxsize=1, ttl=60))
def get_all_uncompleted_orders_table():
    # Бизнес-логика получения данных
    # Кэширование результатов
    # Преобразование типов данных
```

**Принципы:**
- Разделение бизнес-логики и представления
- Кэширование для оптимизации производительности
- Обработка и преобразование данных

#### Слой маршрутов (Route Layer)
```python
# routes/uncompleted_orders_table.py
@uncompleted_orders_table_bp.route('/api/uncompleted-orders/table', methods=['GET'])
def get_table():
    # Обработка HTTP запросов
    # Вызов сервисов
    # Возврат JSON ответов
```

**Принципы:**
- Использование Flask Blueprint для модульности
- RESTful API дизайн
- CORS поддержка для фронтенда

### Frontend Architecture

#### Компонентная архитектура
```
App (Root Component)
├── Sidebar (Navigation)
│   ├── SidebarIcon (Individual Icons)
│   └── LanguageSwitcher (Language Control)
└── Main Content (Route-based)
    └── UncompletedOrdersTable (Data Display)
        ├── CustomTableBuilder (Table Logic)
        ├── FieldsSelectorPopover (Field Selection)
        └── DataTable (Table Component)
            ├── ColumnToggle (Column Management)
            └── FilterPopover (Filtering)
```

#### Управление состоянием
```typescript
// App.tsx - Global State
const [expanded, setExpanded] = useState<boolean>(() =>
    JSON.parse(localStorage.getItem("sidebarExpanded") ?? "true")
);

// Local Storage persistence
localStorage.setItem("sidebarExpanded", JSON.stringify(!prev));
```

**Принципы:**
- Локальное состояние компонентов
- Persistence в localStorage для пользовательских настроек
- Props drilling для передачи данных между компонентами

#### Интернационализация
```typescript
// i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslations },
      ru: { translation: ruTranslations }
    },
    lng: 'ru',
    fallbackLng: 'en'
  });
```

**Файлы переводов:**
- `sidebarTranslation.json` - переводы сайдбара
- `ordersTranslation.json` - переводы страницы заказов
- `dataTableTranslation.json` - переводы компонентов таблицы

## 🎨 UI/UX Компоненты

### Сайдбар (Sidebar.tsx)

#### Анимация
```typescript
// Трехфазная анимация
const sidebarVariants = {
  collapsed: { width: 64 },
  expanded: { width: 240 },
  fullyExpanded: { width: 240 }
};

const iconVariants = {
  collapsed: { x: 0 },
  expanded: { x: 12 }
};
```

**Этапы анимации:**
1. `internalExpanded` - внутреннее состояние
2. `sidebarFullyExpanded` - сайдбар полностью развернут
3. `iconsFullyShifted` - иконки смещены

#### Tooltip система
```typescript
// CSS-based tooltips
<div className="group relative">
  <Icon />
  <div className="absolute left-12 top-1/2 -translate-y-1/2 
                  bg-gray-800 text-white px-2 py-1 rounded text-sm
                  opacity-0 group-hover:opacity-100 transition-opacity">
    {t('sidebar.orders')}
  </div>
</div>
```

### Таблица данных (DataTable.tsx)

#### Функциональность
- **Сортировка**: По любому столбцу (asc/desc)
- **Фильтрация**: Текстовый поиск по всем полям
- **Группировка**: По выбранным полям
- **Экспорт**: CSV формат
- **Выбор колонок**: Показ/скрытие столбцов

#### Производительность
```typescript
// Виртуализация для больших данных
const { rows } = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getGroupedRowModel: getGroupedRowModel(),
});
```

## 🔄 Потоки данных

### Запрос данных
```
1. Frontend: UncompletedOrdersTable.tsx
   ↓ fetch('/api/uncompleted-orders/table')
2. Backend: routes/uncompleted_orders_table.py
   ↓ get_all_uncompleted_orders_table()
3. Backend: services/uncompleted_orders_table.py
   ↓ get_connection()
4. Database: SQL Server
   ↓ SELECT * FROM dbo.Uncompleted_Orders
```

### Обработка ответа
```
1. Database: Raw data
   ↓ pyodbc cursor.fetchall()
2. Backend: Python objects
   ↓ try_convert_value() - преобразование типов
3. Backend: JSON serialization
   ↓ jsonify()
4. Frontend: JavaScript objects
   ↓ JSON.parse()
5. Frontend: React state
   ↓ setData()
```

## 🛡️ Безопасность

### Backend Security
- **CORS**: Настроен для разработки (разрешен любой origin)
- **SQL Injection**: Использование параметризованных запросов
- **Environment Variables**: Конфиденциальные данные в .env файле
- **Error Handling**: Обработка ошибок без раскрытия внутренней структуры

### Frontend Security
- **XSS Protection**: React автоматически экранирует данные
- **Type Safety**: TypeScript предотвращает ошибки типов
- **Input Validation**: Валидация на уровне компонентов

## 📊 Производительность

### Backend Optimizations
- **Кэширование**: TTLCache с TTL 60 секунд
- **Connection Pooling**: Переиспользование соединений с БД
- **Data Transformation**: Оптимизированное преобразование типов

### Frontend Optimizations
- **Code Splitting**: Разделение кода по маршрутам
- **Memoization**: React.memo для компонентов
- **Lazy Loading**: Отложенная загрузка компонентов
- **Bundle Optimization**: Vite для быстрой сборки

## 🧪 Тестирование

### Backend Testing
```python
# Пример unit теста
def test_get_connection():
    conn = get_connection()
    assert conn is not None
    conn.close()
```

### Frontend Testing
```typescript
// Пример component теста
import { render, screen } from '@testing-library/react';
import UncompletedOrdersTable from './UncompletedOrdersTable';

test('renders table with data', () => {
  render(<UncompletedOrdersTable />);
  expect(screen.getByRole('table')).toBeInTheDocument();
});
```

## 🔧 Конфигурация

### Environment Variables
```env
# Database Configuration
DB_SERVER=localhost
DB_NAME=BigStatistics
DB_USER=sa
DB_PASSWORD=your_password

# Application Configuration
FLASK_ENV=development
FLASK_DEBUG=true
```

### Build Configuration
```json
// package.json scripts
{
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
}
```

## 📈 Мониторинг и логирование

### Backend Logging
```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

### Frontend Error Tracking
```typescript
// Error boundary для React компонентов
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error:', error, errorInfo);
  }
}
```

## 🚀 Deployment

### Backend Deployment
```bash
# Production setup
pip install -r requirements.txt
gunicorn -w 4 -b 0.0.0.0:5000 Run_Server:app
```

### Frontend Deployment
```bash
# Build for production
npm run build

# Serve static files
npx serve -s dist
```

## 🔮 Roadmap

### Планируемые улучшения
1. **WebSocket Integration**: Реал-тайм обновления данных
2. **Advanced Analytics**: Графики и диаграммы
3. **User Authentication**: Система авторизации
4. **Mobile App**: React Native приложение
5. **Microservices**: Разделение на отдельные сервисы
6. **Docker**: Контейнеризация приложения
7. **CI/CD**: Автоматизация развертывания 