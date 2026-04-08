# Добавление нового источника данных из 1C

Это инструкция для IT специалиста. После её выполнения новые данные из 1C будут автоматически копироваться в БД, отображаться в актуальном виде через SQL View и мониториться через Admin Panel сайта.

---

## Что вы получите на входе

Готовый SQL запрос к базе данных 1C, который возвращает нужные данные. Например:

```sql
SELECT
    _IDRRef       AS DocID,
    _Date_Time    AS DocDate,
    _Fld12345     AS SomeField,
    _Fld67890     AS AnotherField
FROM _Document1234
WHERE _Date_Time >= @StartDay AND _Date_Time < DATEADD(DAY, 1, @FinishDay)
```

> **Важно:** Даты в 1C смещены ровно на +2000 лет. `2025-01-01` хранится как `4025-01-01`. Это учитывается автоматически в Python скрипте.

---

## Архитектура (как всё устроено)

```
1C Database
    │
    │  SQL запрос (Python читает напрямую из 1C через pyodbc)
    ▼
stg_<TableName>          ← буфер, Python пишет сюда с новым SnapshotID
    │
    │  sp_SwitchSnapshot_<TableName> (атомарный перенос)
    ▼
<TableName>              ← продакшн таблица, хранит данные всех снапшотов
    │
    │  JOIN с SnapshotPointer
    ▼
vw_<TableName>_Current   ← View, показывает только актуальный снапшот
    │
    ▼
Запросы сайта / другие процедуры
```

**SnapshotPointer** — таблица-реестр. Хранит `TableName → SnapshotID`. View всегда джойнится с ней и показывает только текущие данные.

**Два режима обновления:**
- `@Full=0` — оконное обновление (Python Continuous: скользящее окно 60 дней)
- `@Full=1` — полное обновление (Python Full Sync: вся история раз в неделю)

---

## Пошаговая инструкция

### Шаг 1. Определить тип данных

Перед началом ответьте на два вопроса:

| Вопрос | Ответ → тип |
|--------|-------------|
| Есть ли в данных поле с датой документа? | Да → **Windowed** (скользящее окно) |
| Данные меняются часто (каждые минуты/часы)? | Нет → **Full Dump** (полный дамп раз в сутки/неделю) |

**Windowed** (пример: заказы, отгрузки, QC журнал) — подходит, когда нужна актуальность в реальном времени. Python обновляет последние N дней по кругу.

**Full Dump** (пример: BOM, справочник номенклатуры, рабочие центры) — подходит для справочников, которые меняются редко.

---

### Шаг 2. Создать структуру в базе данных

Выполните следующие DDL команды в MS SQL Server (в схеме `Import_1C`).

#### 2.1 Staging таблица

```sql
CREATE TABLE Import_1C.stg_MyData (
    -- Скопируйте сюда все поля из SQL запроса к 1C:
    DocID         varbinary(16),
    DocDate       date,
    SomeField     nvarchar(510),
    AnotherField  nvarchar(510),
    -- ОБЯЗАТЕЛЬНОЕ поле — всегда последнее:
    SnapshotID    uniqueidentifier NOT NULL
);
```

#### 2.2 Продакшн таблица

```sql
-- Идентична staging, только другое имя:
CREATE TABLE Import_1C.MyData (
    DocID         varbinary(16),
    DocDate       date,
    SomeField     nvarchar(510),
    AnotherField  nvarchar(510),
    -- ОБЯЗАТЕЛЬНОЕ поле:
    SnapshotID    uniqueidentifier NOT NULL
);
```

> Оба набора колонок должны быть **идентичны**. Хранимая процедура сама определяет общие колонки динамически — добавление нового поля в обе таблицы сработает без изменения SP.

#### 2.3 View для актуальных данных

```sql
CREATE VIEW Import_1C.vw_MyData_Current AS
SELECT t.*
FROM Import_1C.MyData AS t
JOIN Import_1C.SnapshotPointer AS p
  ON p.TableName = 'Import_1C.MyData'
 AND t.SnapshotID = p.SnapshotID;
```

#### 2.4 Хранимая процедура переключения снапшота

**Для Windowed данных** (есть дата, два режима):

```sql
CREATE PROC Import_1C.sp_SwitchSnapshot_MyData
    @SnapshotID   UNIQUEIDENTIFIER,
    @DateFrom     DATE = NULL,
    @DateTo       DATE = NULL,
    @Full         BIT  = 0,
    @CleanupPrev  BIT  = 1
AS BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;

    DECLARE @lock SYSNAME = N'Import_1C.MyData';
    DECLARE @PrevSnapshot UNIQUEIDENTIFIER =
        (SELECT SnapshotID FROM Import_1C.SnapshotPointer
         WHERE TableName = 'Import_1C.MyData');

    IF NOT EXISTS (SELECT 1 FROM Import_1C.stg_MyData WHERE SnapshotID = @SnapshotID)
        THROW 52001, 'stg_MyData is empty for given SnapshotID', 1;

    -- Список колонок определяется динамически
    DECLARE @colList NVARCHAR(MAX);
    ;WITH tgt AS (SELECT c.name, c.column_id FROM sys.columns c
                  WHERE c.object_id = OBJECT_ID('Import_1C.MyData') AND c.is_computed = 0),
          stg AS (SELECT c.name FROM sys.columns c
                  WHERE c.object_id = OBJECT_ID('Import_1C.stg_MyData') AND c.is_computed = 0)
    SELECT @colList = STRING_AGG(QUOTENAME(t.name), ', ') WITHIN GROUP (ORDER BY t.column_id)
    FROM tgt t JOIN stg s ON s.name = t.name;

    IF @colList IS NULL OR CHARINDEX('[SnapshotID]', @colList) = 0
        THROW 52004, 'Common column list is empty or SnapshotID missing', 1;

    EXEC sp_getapplock @Resource=@lock, @LockMode='Exclusive',
                       @LockOwner='Session', @LockTimeout=60000;
    BEGIN TRY
        BEGIN TRAN;
        DECLARE @sql NVARCHAR(MAX);

        IF @Full = 1 BEGIN
            SET @sql = N'INSERT INTO Import_1C.MyData(' + @colList + N')
                         SELECT ' + @colList + N' FROM Import_1C.stg_MyData
                         WHERE SnapshotID = @sid;';
            EXEC sp_executesql @sql, N'@sid UNIQUEIDENTIFIER', @sid=@SnapshotID;

            MERGE Import_1C.SnapshotPointer AS tgt
            USING (SELECT CAST(''Import_1C.MyData'' AS sysname) AS TableName,
                          @SnapshotID AS SnapshotID) AS src
            ON tgt.TableName = src.TableName
            WHEN MATCHED     THEN UPDATE SET SnapshotID=src.SnapshotID, UpdatedAt=SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (TableName,SnapshotID) VALUES(src.TableName,src.SnapshotID);

            IF @CleanupPrev = 1
                DELETE FROM Import_1C.MyData WHERE SnapshotID <> @SnapshotID;
        END ELSE BEGIN
            IF @DateFrom IS NULL OR @DateTo IS NULL
                THROW 52002, 'Provide @DateFrom and @DateTo for windowed refresh', 1;

            -- ЗАМЕНИТЕ DocDate на реальное поле с датой вашей таблицы:
            SET @sql = N'INSERT INTO Import_1C.MyData(' + @colList + N')
                         SELECT ' + @colList + N' FROM Import_1C.stg_MyData
                         WHERE SnapshotID = @sid
                           AND DocDate BETWEEN @df AND @dt;';
            EXEC sp_executesql @sql,
                 N'@sid UNIQUEIDENTIFIER, @df DATE, @dt DATE',
                 @sid=@SnapshotID, @df=@DateFrom, @dt=@DateTo;

            MERGE Import_1C.SnapshotPointer AS tgt
            USING (SELECT CAST(''Import_1C.MyData'' AS sysname) AS TableName,
                          @SnapshotID AS SnapshotID) AS src
            ON tgt.TableName = src.TableName
            WHEN MATCHED     THEN UPDATE SET SnapshotID=src.SnapshotID, UpdatedAt=SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (TableName,SnapshotID) VALUES(src.TableName,src.SnapshotID);

            IF @CleanupPrev = 1
                DELETE FROM Import_1C.MyData
                WHERE DocDate BETWEEN @DateFrom AND @DateTo
                  AND SnapshotID <> @SnapshotID;
        END
        COMMIT;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK;
        EXEC sp_releaseapplock @Resource=@lock, @LockOwner='Session';
        THROW;
    END CATCH
    EXEC sp_releaseapplock @Resource=@lock, @LockOwner='Session';

    SELECT
        TableName    = 'Import_1C.MyData',
        FullRefresh  = @Full,
        DateFrom     = @DateFrom, DateTo = @DateTo,
        NewSnapshot  = @SnapshotID, PrevSnapshot = @PrevSnapshot,
        RowsInView   = (SELECT COUNT(*) FROM Import_1C.vw_MyData_Current);
END
```

**Для Full Dump** (справочник, только `@Full=1`) — используйте тот же шаблон, но уберите параметры `@DateFrom`, `@DateTo` и всю ветку `ELSE`.

---

### Шаг 3. Создать папку модуля в проекте

```
Migration/
└── modules/
    └── 1C/
        └── my_data/          ← новая папка (имя строчными буквами, через _)
            ├── __init__.py   ← пустой файл
            ├── sql.py        ← SQL запрос к 1C
            ├── copy_script.py         ← непрерывное копирование (Continuous)
            └── full_sync_script.py    ← полная синхронизация (если нужна)
```

Создайте пустой `__init__.py`:
```python
# пустой файл
```

---

### Шаг 4. Создать sql.py

`Migration/modules/1C/my_data/sql.py`:

```python
# Для данных с датами (вставьте ваш SQL запрос):
QUERY_MY_DATA_TEMPLATE = r"""
DECLARE @StartDay  DATE = '{start_day}';
DECLARE @FinishDay DATE = '{finish_day}';

SELECT
    _IDRRef    AS DocID,
    _Date_Time AS DocDate,
    _Fld12345  AS SomeField
FROM _Document1234
WHERE _Date_Time >= @StartDay
  AND _Date_Time <  DATEADD(DAY, 1, @FinishDay)
"""

# Для справочников (без параметров дат):
# QUERY_MY_REFERENCE = r"""
# SELECT _IDRRef AS ID, _Description AS Name
# FROM _Reference123
# WHERE _Marked = 0x00
# """
```

---

### Шаг 5. Создать copy_script.py

**Для Windowed данных** (скользящее окно, категория `continuous`):

`Migration/modules/1C/my_data/copy_script.py`:

```python
"""Copies MyData from 1C into the target DB (60-day rolling window)."""
import sys
import os
import uuid
from datetime import datetime, timedelta, date as dt_date

_MIG_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, _MIG_ROOT)
sys.path.insert(0, os.path.dirname(__file__))

from core.base import BaseMigration
from core.db import get_1c_connection, get_target_connection
from sql import QUERY_MY_DATA_TEMPLATE

WINDOW_DAYS   = 60                       # глубина скользящего окна в днях
TABLE_STAGING = "Import_1C.stg_MyData"
LOCK_NAME     = "Migration_MyData"       # должен совпадать с full_sync_script


def _ensure_snapshot_id(cur_t):
    """Возвращает текущий SnapshotID или создаёт новый."""
    cur_t.execute("""
        SELECT SnapshotID FROM Import_1C.SnapshotPointer WITH (READCOMMITTED)
        WHERE TableName = 'Import_1C.MyData'
    """)
    row = cur_t.fetchone()
    if row and row[0]:
        return str(row[0])

    new_snap = str(uuid.uuid4())
    cur_t.execute("""
        MERGE Import_1C.SnapshotPointer AS t
        USING (SELECT 'Import_1C.MyData' AS TableName) s ON t.TableName = s.TableName
        WHEN MATCHED     THEN UPDATE SET SnapshotID = ?
        WHEN NOT MATCHED THEN INSERT (TableName, SnapshotID) VALUES (s.TableName, ?);
    """, (new_snap, new_snap))
    return new_snap


class MyDataCopy(BaseMigration):
    script_id        = "1c_my_data"           # уникальный ID — латиница, через _
    script_name      = "My Data Copy (1C)"    # отображается в Admin Panel
    interval_seconds = 60                     # пауза между циклами (секунды)
    category         = "continuous"

    def run_once(self) -> int:
        conn_1c = conn_t = cur_1c = cur_t = None
        try:
            conn_1c = get_1c_connection()
            conn_t  = get_target_connection()
            cur_1c  = conn_1c.cursor()
            cur_t   = conn_t.cursor()
            cur_t.execute("SET XACT_ABORT ON; SET LOCK_TIMEOUT 60000;")

            # Вычислить диапазон дат (реальных)
            today          = datetime.today().date()
            date_to_real   = today
            date_from_real = today - timedelta(days=WINDOW_DAYS)

            # Сдвинуть +2000 лет для запроса в 1C
            start_4025  = dt_date(date_from_real.year + 2000, date_from_real.month, date_from_real.day)
            finish_4025 = dt_date(date_to_real.year + 2000,   date_to_real.month,   date_to_real.day)

            # Выполнить запрос к 1C
            cur_1c.execute(QUERY_MY_DATA_TEMPLATE.format(
                start_day=start_4025.strftime("%Y-%m-%d"),
                finish_day=finish_4025.strftime("%Y-%m-%d")
            ))
            columns_1c = [c[0] for c in cur_1c.description]
            rows_1c    = cur_1c.fetchall()

            if not rows_1c:
                return 0

            # Сдвинуть даты -2000 лет для записи в нашу БД
            # Замените 'DocDate' на реальное имя поля с датой:
            date_fields = ['DocDate']
            date_indices = {f: columns_1c.index(f) for f in date_fields if f in columns_1c}
            if date_indices:
                prepped = []
                for row in rows_1c:
                    row = list(row)
                    for field, idx in date_indices.items():
                        if row[idx] is not None:
                            shifted = row[idx].replace(year=row[idx].year - 2000)
                            row[idx] = shifted.date() if hasattr(shifted, 'date') else shifted
                    prepped.append(tuple(row))
                rows_1c = prepped

            # Получить SnapshotID
            snapshot_id = _ensure_snapshot_id(cur_t)

            # Очистить staging и записать новые данные
            cur_t.execute(f"DELETE FROM {TABLE_STAGING} WHERE SnapshotID = ?", (snapshot_id,))
            insert_cols  = ['SnapshotID'] + columns_1c
            placeholders = ','.join(['?'] * len(insert_cols))
            insert_sql   = f"INSERT INTO {TABLE_STAGING} ({', '.join(insert_cols)}) VALUES ({placeholders})"
            payload = [(snapshot_id,) + tuple(r) for r in rows_1c]
            cur_t.fast_executemany = True
            cur_t.executemany(insert_sql, payload)
            conn_t.commit()  # staging commit

            # Проверка что данные записались
            cur_t.execute(f"SELECT TOP(1) 1 FROM {TABLE_STAGING} WHERE SnapshotID = ?", (snapshot_id,))
            if not cur_t.fetchone():
                return 0

            # App lock перед переключением снапшота (защита от конкурентного full sync)
            self.acquire_applock(cur_t, LOCK_NAME)

            # Удалить старые данные за этот период и вставить новые
            cur_t.execute(
                "DELETE FROM Import_1C.MyData WHERE SnapshotID = ? AND DocDate BETWEEN ? AND ?",
                (snapshot_id, date_from_real, date_to_real)
            )
            cur_t.execute(
                "EXEC Import_1C.sp_SwitchSnapshot_MyData "
                "@SnapshotID=?, @DateFrom=?, @DateTo=?, @Full=0, @CleanupPrev=1",
                (snapshot_id, date_from_real, date_to_real)
            )
            conn_t.commit()

            cur_t.execute("SELECT COUNT(*) FROM Import_1C.vw_MyData_Current")
            return cur_t.fetchone()[0]

        finally:
            for obj in (cur_1c, cur_t, conn_1c, conn_t):
                try:
                    if obj: obj.close()
                except Exception:
                    pass


if __name__ == "__main__":
    MyDataCopy().run()
```

**Для Full Dump** (справочник, категория `continuous`, `interval_seconds = 86400`):

```python
# Те же шаги, но:
# - убрать window/date логику
# - snapshot_id = str(uuid.uuid4())  — каждый раз новый
# - вызов: sp_SwitchSnapshot_MyData @SnapshotID=?, @Full=1, @CleanupPrev=1
# - acquire_applock сразу после staging commit, перед SP
```

---

### Шаг 6. Создать full_sync_script.py (если нужен)

Full Sync нужен для Windowed данных — раз в неделю он перезаписывает всю историю с 2025-01-01.

`Migration/modules/1C/my_data/full_sync_script.py`:

```python
"""MyData Full Sync — full range 4025-01-01 → today+2000, runs weekly."""
import sys
import os
import uuid
from datetime import date as dt_date

_MIG_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, _MIG_ROOT)
sys.path.insert(0, os.path.dirname(__file__))

from core.base import BaseMigration
from core.db import get_1c_connection, get_target_connection
from sql import QUERY_MY_DATA_TEMPLATE

TABLE_STAGING = "Import_1C.stg_MyData"
START_4025    = "4025-01-01"
LOCK_NAME     = "Migration_MyData"       # тот же что в copy_script!


class MyDataFullSync(BaseMigration):
    script_id   = "1c_my_data_full"
    script_name = "My Data Full Sync (1C)"
    category    = "scheduled"

    def run_once(self) -> int:
        conn_1c = conn_t = cur_1c = cur_t = None
        try:
            conn_1c = get_1c_connection()
            conn_t  = get_target_connection()
            cur_1c  = conn_1c.cursor()
            cur_t   = conn_t.cursor()
            cur_t.execute("SET XACT_ABORT ON; SET LOCK_TIMEOUT 120000;")

            today    = dt_date.today()
            end_4025 = f"{today.year + 2000}-{today.month:02d}-{today.day:02d}"

            cur_1c.execute(QUERY_MY_DATA_TEMPLATE.format(
                start_day=START_4025, finish_day=end_4025
            ))
            columns_1c = [c[0] for c in cur_1c.description]
            rows_1c    = cur_1c.fetchall()

            if not rows_1c:
                return 0

            # Сдвиг дат -2000 лет (замените 'DocDate' на реальное поле):
            idx_date = columns_1c.index('DocDate') if 'DocDate' in columns_1c else None
            shifted = []
            for row in rows_1c:
                row = list(row)
                if idx_date is not None and row[idx_date] is not None:
                    v = row[idx_date].replace(year=row[idx_date].year - 2000)
                    row[idx_date] = v.date() if hasattr(v, 'date') else v
                shifted.append(tuple(row))

            snapshot_id  = str(uuid.uuid4())   # всегда новый ID для full sync
            insert_cols  = ['SnapshotID'] + columns_1c
            placeholders = ','.join(['?'] * len(insert_cols))
            insert_sql   = f"INSERT INTO {TABLE_STAGING} ({', '.join(insert_cols)}) VALUES ({placeholders})"
            payload      = [(snapshot_id,) + r for r in shifted]

            cur_t.execute(f"DELETE FROM {TABLE_STAGING} WHERE SnapshotID = ?", (snapshot_id,))
            cur_t.fast_executemany = True
            cur_t.executemany(insert_sql, payload)
            conn_t.commit()  # staging commit

            # App lock — блокирует copy_script пока идёт full sync
            self.acquire_applock(cur_t, LOCK_NAME)

            cur_t.execute(
                "EXEC Import_1C.sp_SwitchSnapshot_MyData @SnapshotID=?, @Full=1, @CleanupPrev=1",
                (snapshot_id,)
            )
            conn_t.commit()

            return len(shifted)

        finally:
            for obj in (cur_1c, cur_t, conn_1c, conn_t):
                try:
                    if obj: obj.close()
                except Exception:
                    pass


if __name__ == "__main__":
    MyDataFullSync().run_once_standalone()
```

---

### Шаг 7. Зарегистрировать в scripts_config.py

Открыть файл `Migration/scripts_config.py` и добавить записи в список `SCRIPTS`.

**Continuous скрипт** (добавить в блок `# ── 1C / continuous`):

```python
{
    "id":               "1c_my_data",
    "name":             "My Data Copy (1C)",
    "category":         "continuous",
    "script":           "modules/1C/my_data/copy_script.py",
    "interval_seconds": 60,          # пауза между циклами
},
```

**Full Sync скрипт** (если нужен, добавить в блок `# ── 1C / weekly full sync`):

```python
{
    "id":            "1c_my_data_full",
    "name":          "My Data Full Sync (1C)",
    "category":      "scheduled",
    "script":        "modules/1C/my_data/full_sync_script.py",
    "schedule_type": "weekly",
    "weekday":       "sunday",
    "time":          "HH:MM",   # выбрать время через 20 минут от предыдущего full sync
},
```

> Текущие времена full sync скриптов: 03:00, 03:20, 03:40, 04:00, 04:20, 04:40, 05:00, 05:20, 05:40.
> Следующий свободный слот: **06:00**.

---

### Шаг 8. Активировать

После добавления скриптов необходимо **перезапустить** runner и scheduler.

**На проде** — перезапустить через `start_production.ps1` или в Admin Panel:
- Найти скрипт в списке (он появится автоматически после перезапуска runner)
- Нажать **Start**

**Проверка работы:**
1. Admin Panel → вкладка Migration → найти `1c_my_data`
2. Статус должен измениться: `never_run` → `running` → `idle`
3. Появятся значения в колонках `Last Success` и `Records`
4. Кнопка `Logs` — просмотр лога выполнения

**Проверка данных в БД:**
```sql
-- Проверить что данные появились:
SELECT TOP 10 * FROM Import_1C.vw_MyData_Current;

-- Проверить SnapshotPointer:
SELECT * FROM Import_1C.SnapshotPointer WHERE TableName = 'Import_1C.MyData';
```

---

## Чеклист

```
[ ] Шаг 1  — Определить тип (Windowed / Full Dump)
[ ] Шаг 2  — Создать stg_MyData в БД
[ ] Шаг 2  — Создать MyData в БД
[ ] Шаг 2  — Создать vw_MyData_Current в БД
[ ] Шаг 2  — Создать sp_SwitchSnapshot_MyData в БД
[ ] Шаг 3  — Создать папку Migration/modules/1C/my_data/
[ ] Шаг 3  — Создать __init__.py (пустой)
[ ] Шаг 4  — Создать sql.py с SQL запросом к 1C
[ ] Шаг 5  — Создать copy_script.py
[ ] Шаг 6  — Создать full_sync_script.py (если Windowed)
[ ] Шаг 7  — Добавить записи в scripts_config.py
[ ] Шаг 8  — Перезапустить runner/scheduler
[ ] Шаг 8  — Проверить в Admin Panel (статус, логи)
[ ] Шаг 8  — Проверить данные через vw_MyData_Current
```

---

## Справочная информация

### Типичные значения interval_seconds

| Данные | interval_seconds |
|--------|-----------------|
| QC журнал, отгрузки (нужна актуальность) | `60` (1 мин) |
| QC карточки, перемещения материалов | `600` (10 мин) |
| Прайс-лист, нормы | `86400` (24 ч) |
| Справочники (BOM, номенклатура) | `86400` (24 ч) |

### Типичные значения WINDOW_DAYS

| Данные | WINDOW_DAYS |
|--------|-------------|
| Оперативные данные (QC, факт сканирования) | `14–30` |
| Финансовые, заказы | `60–90` |
| Прайсы, нормативы | `365` |

### Структура папки модуля

```
my_data/
├── __init__.py          ← пустой, обязателен
├── sql.py               ← SQL запрос(ы) к 1C
├── copy_script.py       ← Continuous / Full Dump скрипт
└── full_sync_script.py  ← Full Sync (только для Windowed данных)
```

### Соглашения по именованию

| Что | Формат | Пример |
|-----|--------|--------|
| Папка модуля | `snake_case` | `my_data` |
| `script_id` | `1c_snake_case` | `1c_my_data` |
| `script_id` full sync | `1c_snake_case_full` | `1c_my_data_full` |
| Staging таблица | `stg_PascalCase` | `stg_MyData` |
| Продакшн таблица | `PascalCase` | `MyData` |
| View | `vw_PascalCase_Current` | `vw_MyData_Current` |
| SP | `sp_SwitchSnapshot_PascalCase` | `sp_SwitchSnapshot_MyData` |
| App lock (Python) | `Migration_PascalCase` | `Migration_MyData` |

### Как работает защита от конкурентного доступа

Когда `copy_script` и `full_sync_script` работают одновременно, два уровня защиты предотвращают конфликты:

1. **Python App Lock** (`acquire_applock` в BaseMigration) — оба скрипта используют одно имя `LOCK_NAME`. Второй скрипт ждёт пока первый не сделает `COMMIT`.

2. **SQL Server App Lock внутри SP** — хранимая процедура сама берёт эксклюзивную блокировку на имя `'Import_1C.MyData'`. Если два вызова SP идут из разных соединений, второй ждёт.

Благодаря двойной защите данные никогда не будут в несогласованном состоянии.
