# QC.LQC_Journal

## Назначение

Физическая таблица с данными журнала линейного контроля качества (LQC). Содержит построчные записи о проверках: что проверяли, сколько произвели, сколько забраковали, кто виновник и какой тип дефекта. Обогащена группой товара и фактом выпуска из смежных источников. Используется как основной источник данных для LQC-аналитики в дашборде.

---

## Источники данных

| Источник | Что берём |
|---|---|
| `Import_1C.vw_QC_Journal_Current` | Основа — все строки журнала QC из 1С (фильтр `Doc_Type = 1` — только LQC) |
| `Ref.Product_Guide` | `LargeGroup`, `GroupName` — большая группа и группа товара по артикулу детали |
| `Views_For_Plan.DailyPlan_CustomWS` | `Prod_QTY` — факт выпуска по заказу и контрольной точке на дату записи |

---

## Логика обогащения

### Группа товара (`LargeGroup`, `GroupName`)

Артикул детали (`Work_Nomenclature_No`) из 1С может содержать лишние пробелы, табуляции и спецсимволы. Перед джойном с `Ref.Product_Guide` поле очищается через цепочку `REPLACE` по символам `CHAR(9)`, `CHAR(160)`, `CHAR(13)` и затем `LTRIM/RTRIM`. Джойн идёт по полю `FactoryNumber` справочника.

### Факт выпуска (`Prod_QTY`)

Факт выпуска подтягивается из `Views_For_Plan.DailyPlan_CustomWS` через `OUTER APPLY` по трём условиям:
- `OnlyDate = Date` — та же дата
- `ProductionOrderID = Prod_Order_ID` — тот же производственный заказ
- `WorkCenter_CustomID = Control_Tochka_ID` — та же контрольная точка

**Особый случай:** Одна из контрольных точек в LQC-журнале (`Control_Tochka_ID = 0xB5BD...AF`) маппируется на другой `WorkCenter_CustomID` (`0xB5BD...33`) в таблице выпуска — используется `CASE WHEN` для подстановки правильного ID.

---

## Структура таблицы

### Поля из `Import_1C.vw_QC_Journal_Current`

| Колонка | Тип | Описание |
|---|---|---|
| `Date` | DATE | Дата записи журнала |
| `Doc_ID` | VARBINARY(16) | ID документа в 1С |
| `Delete_Mark` | VARBINARY(1) | Пометка на удаление |
| `Post_Mark` | VARBINARY(1) | Признак проведения документа |
| `Doc_No` | NVARCHAR(255) | Номер документа |
| `Doc_Type` | INT | Тип документа (всегда `1` = LQC) |
| `Avtor` | NVARCHAR(255) | Автор записи |
| `Prod_Order_ID` | VARBINARY(16) | ID производственного заказа |
| `Prod_Order_No` | NVARCHAR(255) | Номер производственного заказа |
| `Customer_Order_ID` | VARBINARY(16) | ID заказа клиента |
| `Customer_Order_No` | NVARCHAR(255) | Номер заказа клиента |
| `Control_Tochka_ID` | VARBINARY(16) | ID контрольной точки |
| `Control_Tochka_Ru` | NVARCHAR(255) | Название контрольной точки (рус) |
| `Control_Tochka_Zh` | NVARCHAR(255) | Название контрольной точки (кит) |
| `Defect_Type_ID` | VARBINARY(16) | ID типа дефекта |
| `Defect_Type_Ru` | NVARCHAR(255) | Тип дефекта (рус) |
| `Defect_Type_Zh` | NVARCHAR(255) | Тип дефекта (кит) |
| `Vinovnik_Dep_ID` | VARBINARY(16) | ID отдела-виновника |
| `Vinovnik_Dep_Ru` | NVARCHAR(255) | Отдел-виновник (рус) |
| `Vinovnik_Dep_Zh` | NVARCHAR(255) | Отдел-виновник (кит) |
| `Work_Nomenclature_ID` | VARBINARY(16) | ID проверяемой детали |
| `Work_Nomenclature_No` | NVARCHAR(255) | Артикул проверяемой детали |
| `Work_Nomenclature_NameRU` | NVARCHAR(255) | Название детали (рус) |
| `Work_Nomenclature_Namezh` | NVARCHAR(255) | Название детали (кит) |
| `Prod_Fact_QTY` | DECIMAL(18,4) | Количество произведённого |
| `Defect_QTY` | DECIMAL(18,4) | Количество брака |
| `PCI_QTY` | DECIMAL(18,4) | Количество PCI |
| `PCIRemove_To_Rework_QTY` | DECIMAL(18,4) | Количество отправленных на переработку |
| `Problem_Description` | NVARCHAR(MAX) | Описание проблемы |
| `Problem_Description1` | NVARCHAR(MAX) | Дополнительное описание проблемы |
| `QC_Status` | NVARCHAR(255) | Статус контроля |

### Поля из обогащения

| Колонка | Тип | Источник | Описание |
|---|---|---|---|
| `LargeGroup` | NVARCHAR(255) | `Ref.Product_Guide` | Большая группа товара |
| `GroupName` | NVARCHAR(255) | `Ref.Product_Guide` | Группа товара |
| `Prod_QTY` | DECIMAL(18,4) | `Views_For_Plan.DailyPlan_CustomWS` | Факт выпуска по заказу и контрольной точке |

### Служебное поле

| Колонка | Тип | Описание |
|---|---|---|
| `Refreshed_At` | DATETIME2 | Время последнего обновления таблицы (UTC, проставляется автоматически) |

---

## Процедура обновления

### `QC.sp_Refresh_LQC_Journal`

Полное пересоздание данных: `TRUNCATE` + `INSERT`. Запускается автоматически из Python скрипта каждую минуту.

```sql
EXEC QC.sp_Refresh_LQC_Journal;
```

**Алгоритм:**
1. `TRUNCATE TABLE QC.LQC_Journal` — очистка
2. `INSERT INTO` — вставка всех записей из `vw_QC_Journal_Current` с фильтром `Doc_Type = 1`
3. Одновременно подтягивает `LargeGroup`/`GroupName` через `LEFT JOIN Ref.Product_Guide`
4. Одновременно подтягивает `Prod_QTY` через `OUTER APPLY` к `DailyPlan_CustomWS`

---

## Обновление данных

| Скрипт | Тип | Тайминг |
|---|---|---|
| `DB_Docs/LQC/1C_QC_Journal_CopyScript.py` | Автоматический | Каждую **1 минуту** |
| `DB_Docs/LQC/1C_QC_Journal_OneCopy.py` | Ручной запуск | По требованию (полная загрузка с 2025-01-01) |

### Порядок выполнения в CopyScript

```
1. Получить записи журнала из 1С за последние 60 дней
2. Загрузить в staging (Import_1C.stg_QC_Journal)
3. EXEC Import_1C.sp_SwitchSnapshot_QC_Journal   ← переключение снапшота
4. EXEC QC.sp_Refresh_LQC_Journal                ← пересчёт этой таблицы
```

> **Окно обновления:** скрипт заменяет только данные за последние **60 дней** — данные старше сохраняются.

> **Сдвиг дат 1С:** в базе 1С даты хранятся со сдвигом **+2000 лет** (2025 год → 4025 год). Python скрипт при импорте автоматически вычитает 2000 лет.

---

## Схема и объект

- **Схема:** `QC`
- **Тип объекта:** TABLE (физическая таблица)
- **Полное имя:** `QC.LQC_Journal`
- **Процедура обновления:** `QC.sp_Refresh_LQC_Journal`

---

## Индексы

| Индекс | Поле | Назначение |
|---|---|---|
| `IX_LQC_Journal_Date` | `Date` | Фильтрация по дате |
| `IX_LQC_Journal_Doc_ID` | `Doc_ID` | Поиск по ID документа |

---

## Зависимости

| Объект | Тип | Описание |
|---|---|---|
| `Import_1C.vw_QC_Journal_Current` | VIEW | Текущий снапшот журнала QC из 1С |
| `Import_1C.stg_QC_Journal` | TABLE | Staging таблица для загрузки из 1С |
| `Import_1C.sp_SwitchSnapshot_QC_Journal` | PROCEDURE | Переключение снапшота |
| `Ref.Product_Guide` | TABLE | Справочник продукции (группы товара) |
| `Views_For_Plan.DailyPlan_CustomWS` | VIEW | Факт выпуска по заказам и цехам |

---

## Файлы

| Файл | Описание |
|---|---|
| `DB_Docs/LQC/LQC_Journal_DDL.sql` | DDL таблицы и процедуры `QC.sp_Refresh_LQC_Journal` |
| `DB_Docs/LQC/sql_queries.py` | SQL запросы импорта журнала из 1С |
| `DB_Docs/LQC/1C_QC_Journal_CopyScript.py` | Python скрипт автоматического копирования (каждую минуту) |
| `DB_Docs/LQC/1C_QC_Journal_OneCopy.py` | Python скрипт ручной полной загрузки |
