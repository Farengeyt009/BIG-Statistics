# Order Statistics API

API для получения данных статистики заказов (графики, сводные таблицы).

## Основные принципы

- **Источник данных**: `Orders.Orders_1C_Svod` (VIEW в базе данных)
- **Фильтр**: Всегда применяется стандартный отчет с `ReportID = 1`
- **Назначение**: Данные для построения графиков и сводных таблиц во вкладке Statistics

---

## Endpoints

### 1. Получение данных статистики

```http
GET /api/orders/statistics/data
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "report_id": 1,
  "report_name": "Все заказы",
  "columns": [
    "OrderDate",
    "Market",
    "Order_No",
    "Article_number",
    "Total_Order_QTY",
    "ToProduce_QTY",
    "ProductionFact_QTY",
    "RemainingToProduce_QTY",
    "Shipment_QTY",
    ...
  ],
  "data": [
    {
      "OrderDate": "01.08.2025",
      "Market": "China",
      "Order_No": "CH2025-001",
      "Total_Order_QTY": 1000,
      "ToProduce_QTY": 1000,
      "ProductionFact_QTY": 600,
      "RemainingToProduce_QTY": 400,
      ...
    },
    ...
  ],
  "total_records": 1500
}
```

**Описание полей:**
- `report_id` - ID отчета (всегда = 1)
- `report_name` - Название отчета
- `columns` - Список колонок
- `data` - Массив данных (каждый объект = одна строка)
- `total_records` - Количество записей

---

### 2. Получение метаданных

```http
GET /api/orders/statistics/metadata
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "fields": [
    {"name": "OrderDate", "type": "datetime"},
    {"name": "Market", "type": "str"},
    {"name": "Total_Order_QTY", "type": "int"},
    {"name": "RemainingToProduce_QTY", "type": "int"},
    ...
  ],
  "total_fields": 35
}
```

**Назначение**: Получение списка всех доступных полей и их типов данных.

---

## Стандартный отчет (ReportID = 1)

**Используется существующий отчет из базы данных `Users.UserReports`**

**Параметры отчета:**
- **ReportID**: 1
- **ReportName**: "Все заказы"
- **SourceTable**: `Orders.Orders_1C_Svod`
- **IsTemplate**: 1 (стандартный отчет, доступен всем пользователям)
- **IsEditable**: зависит от прав пользователя (администраторы могут редактировать)
- **Filters**: применяются фильтры из отчета

**Поля отчета:**
1. `OrderDate` - Дата заказа
2. `Market` - Рынок (China, Russia, etc.)
3. `Order_No` - Номер заказа
4. `Article_number` - Артикул
5. `LargeGroup` - Большая группа товаров
6. `GroupName` - Название группы
7. `Total_Order_QTY` - Общее количество в заказе
8. `ToProduce_QTY` - План к производству
9. `ProductionFact_QTY` - Фактически произведено
10. `RemainingToProduce_QTY` - **Остаток к производству** ⭐ (новое поле)
11. `Shipment_QTY` - Количество отгружено
12. `AggregatedShipmentDate` - Дата отгрузки (сводная)

---

## Использование на фронте

### Пример запроса данных:

```typescript
const fetchStatisticsData = async () => {
  const response = await fetch('/api/orders/statistics/data', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  const result = await response.json();
  
  if (result.success) {
    const { data, columns } = result;
    // Используем data для построения графиков
    buildCharts(data);
  }
};
```

### Пример построения графика:

```typescript
// Группировка по рынкам
const groupedByMarket = data.reduce((acc, row) => {
  const market = row.Market;
  if (!acc[market]) {
    acc[market] = {
      totalOrders: 0,
      totalQty: 0,
      remainingQty: 0,
    };
  }
  acc[market].totalOrders += 1;
  acc[market].totalQty += row.Total_Order_QTY;
  acc[market].remainingQty += row.RemainingToProduce_QTY;
  return acc;
}, {});

// Строим график
const chartData = Object.entries(groupedByMarket).map(([market, stats]) => ({
  market,
  ...stats,
}));
```

---

## Расширение функционала

В будущем можно добавить:

1. **Дополнительные фильтры** (по датам, рынкам, группам товаров)
2. **Агрегации** (сумма, среднее, группировка)
3. **Кэширование** (для быстрой загрузки)
4. **Экспорт** (CSV, Excel)

Для этого достаточно расширить функции в `OrderStatistics_service.py` и добавить новые endpoints в `OrderStatistics_api.py`.

---

## Структура файлов

```
Back/orders/
├── api/
│   └── OrderData/
│       ├── OrderData_api.py          # API для Order Log (отчеты)
│       └── OrderStatistics_api.py    # API для Statistics ⭐
└── service/
    └── OrderData/
        ├── OrderData_service.py      # Сервис для Order Log
        └── OrderStatistics_service.py # Сервис для Statistics ⭐
```

---

## Отличия от Order Log

| Характеристика | Order Log | Statistics |
|----------------|-----------|------------|
| Назначение | Просмотр и выгрузка данных в таблице | Графики и аналитика |
| Фильтры | Пользователь выбирает отчет | Всегда отчет ID=1 |
| Отчеты | Стандартные + пользовательские | Только стандартный |
| Формат данных | AG Grid таблица | JSON для графиков |
| Редактирование | Report Manager | Нет (только просмотр) |

