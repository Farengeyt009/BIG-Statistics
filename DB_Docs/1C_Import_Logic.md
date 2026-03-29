# Documentation: 1C Data Import System to SQL Server

## Table of Contents
1. [System Overview](#system-overview)
2. [Database Architecture](#database-architecture)
3. [Two Import Patterns](#two-import-patterns)
4. [Python Scripts Structure](#python-scripts-structure)
5. [Example 1: Daily_PlanFact (Window Refresh)](#example-1-daily_planfact-window-refresh)
6. [Example 2: Import_BOM (Full Refresh)](#example-2-import_bom-full-refresh)
7. [Checklist for Adding New Table](#checklist-for-adding-new-table)

---

## System Overview

### Purpose
The system is designed for **periodic data copying** from 1C database to our SQL Server database using **snapshots mechanism** to ensure data consistency.

### Project Organization Principle

**Each data import task = Separate isolated folder**

Each folder contains:
- `sql_queries.py` - SQL queries ONLY for this specific task
- Python copy scripts (CopyScript, OneCopy)
- Log files for this task

**Shared across all tasks** (in project root):
- `database_connector.py` - database connection module
- `database_Information.py` - database configurations

**Example:** `1C_BOM/` folder has its own `sql_queries.py` with BOM queries only. It does NOT share queries with `1C_PriceList/` folder.

### Key Concepts

1. **Staging tables** (`stg_*`) - temporary tables for loading data from 1C
2. **Main tables** - final data storage
3. **SnapshotID** - unique identifier for each data load
4. **SnapshotPointer** - pointer table to current active snapshot
5. **VIEW** - view for getting current data
6. **Stored Procedure** - snapshot switching procedure

### Important: 1C Dates

**IMPORTANT:** In 1C database, dates are stored with **+2000 years shift** (e.g., year 2025 is stored as 4025).

When copying, **all DATE type fields** must be shifted by **-2000 years** to get real dates.

---

## Database Architecture

### Structure for Each Imported Table

For each table, **4 objects** are created:

#### 1. Main Table (`Import_1C.{TableName}`)

**Purpose:** Storage of final data

**Required elements:**
- All business fields (from 1C)
- `SnapshotID uniqueidentifier NOT NULL` - snapshot identifier
- Index on `SnapshotID`: `CREATE INDEX IX_{TableName}_SnapshotID`
- **Optional:** Unique index on natural key (if deduplication needed)

**Example structure:**
```sql
CREATE TABLE Import_1C.Daily_PlanFact
(
    -- Business fields
    DocementID         varbinary(16),
    WorkCentorID       varbinary(16),
    OnlyDate           date,
    Plan_QTY           int,
    -- ... other fields ...
    
    -- Required field
    SnapshotID         uniqueidentifier NOT NULL
);

-- Required index
CREATE INDEX IX_Daily_PlanFact_SnapshotID
    ON Import_1C.Daily_PlanFact (SnapshotID);

-- Optional: unique index (if deduplication needed)
CREATE UNIQUE INDEX UX_Daily_PlanFact_Key
    ON Import_1C.Daily_PlanFact (SnapshotID, OnlyDate, WorkCentorID, WorkNumberID, ProductionOrderID, NomenclatureID);
```

#### 2. Staging Table (`Import_1C.stg_{TableName}`)

**Purpose:** Temporary data storage before snapshot switch

**Structure:** Completely identical to main table

**Example:**
```sql
CREATE TABLE Import_1C.stg_Daily_PlanFact
(
    -- Exactly same fields as main table
    DocementID         varbinary(16),
    -- ...
    SnapshotID         uniqueidentifier NOT NULL
);

CREATE INDEX IX_stg_Daily_PlanFact_SnapshotID
    ON Import_1C.stg_Daily_PlanFact (SnapshotID);
```

#### 3. VIEW for Current Data (`Import_1C.vw_{TableName}_Current`)

**Purpose:** Automatically shows data from current active snapshot

**Standard structure (same for all tables):**
```sql
CREATE VIEW Import_1C.vw_{TableName}_Current
AS
SELECT t.*
FROM Import_1C.{TableName} AS t
JOIN Import_1C.SnapshotPointer AS p
  ON p.TableName = 'Import_1C.{TableName}'
 AND t.SnapshotID = p.SnapshotID;
```

**Usage:** Always query VIEW, not table directly:
```sql
SELECT * FROM Import_1C.vw_Daily_PlanFact_Current
```

#### 4. Stored Procedure (`Import_1C.sp_SwitchSnapshot_{TableName}`)

**Purpose:** Atomic snapshot switching with locking

**Parameters:**
- `@SnapshotID` - new snapshot ID
- `@DateFrom` - window start date (for window refresh)
- `@DateTo` - window end date (for window refresh)
- `@Full` - full refresh flag (1) or window refresh (0)
- `@CleanupPrev` - delete previous snapshot flag (1) or keep (0)

**Logic:**
1. Lock table via `sp_getapplock`
2. Check data exists in staging
3. Insert data from staging to main table
4. Update `SnapshotPointer`
5. Delete old snapshots (if `@CleanupPrev = 1`)
6. Release lock

**Usage variants:**

**A. Full refresh:**
```sql
EXEC Import_1C.sp_SwitchSnapshot_Import_BOM
  @SnapshotID = 'guid',
  @Full = 1,
  @CleanupPrev = 1;
```

**B. Window refresh (specific dates only):**
```sql
EXEC Import_1C.sp_SwitchSnapshot_Daily_PlanFact
  @SnapshotID = 'guid',
  @DateFrom = '2025-11-20',
  @DateTo = '2026-01-19',
  @Full = 0,
  @CleanupPrev = 1;
```

---

### Common SnapshotPointer Table

**Purpose:** Stores pointer to current active SnapshotID for each table

**Structure:**
```sql
CREATE TABLE Import_1C.SnapshotPointer
(
    TableName  sysname NOT NULL PRIMARY KEY,    -- Table name (e.g. 'Import_1C.Daily_PlanFact')
    SnapshotID uniqueidentifier NOT NULL,        -- Current active SnapshotID
    UpdatedAt  datetime2(0) DEFAULT sysutcdatetime() NOT NULL
);
```

**Example data:**
| TableName | SnapshotID | UpdatedAt |
|-----------|------------|-----------|
| Import_1C.Daily_PlanFact | 38dee553-... | 2026-01-19 12:00:00 |
| Import_1C.Import_BOM | 7a2b3c4d-... | 2026-01-19 08:00:00 |

---

## Two Import Patterns

### Pattern 1: Window Refresh

**When to use:**
- Table has **date field** (e.g. `OnlyDate`)
- Data is **large**, full refresh takes long time
- Need to refresh only **last N days**
- Rows are **unique** by combination (date + other keys)

**Characteristics:**
- **One common SnapshotID** always used (doesn't change between runs)
- Only rows in **date window** are refreshed (e.g., last 60 days)
- **Deduplication required** (by date + natural key)
- Run frequency: **often** (e.g., every 60 seconds)

**Example:** `Daily_PlanFact` - refreshed every minute, 60-day window

---

### Pattern 2: Full Refresh

**When to use:**
- Table **without date** field or date not important for filtering
- Data is **relatively small** (up to few hundred thousand rows)
- Need to **completely replace** all data
- May have **duplicates** (uniqueness not required)

**Characteristics:**
- **New SnapshotID** on each run
- Load **all data** from 1C
- **Deduplication optional** (only if required)
- Run frequency: **rarely** (e.g., once per 24 hours)

**Example:** `Import_BOM` - refreshed once per day, all rows replaced

---

## Python Scripts Structure

### General Project Structure

```
project/
├── database_connector.py          # Common DB connection module (shared)
├── database_Information.py        # DB configs (shared): db_config_1c, db_config_myserver
│
├── 1C_PlanFact/                   # Self-contained task folder
│   ├── sql_queries.py             # SQL queries ONLY for PlanFact
│   ├── 1C_PlanFactCopyScript.py   # Automatic (loop)
│   ├── 1C_PlanFactOneCopy.py      # Manual run
│   └── migration.log              # Logs for this task
│
├── 1C_BOM/                        # Self-contained task folder
│   ├── sql_queries.py             # SQL queries ONLY for BOM
│   ├── 1C_BOM_CopyScript.py       # Automatic (loop)
│   ├── 1C_BOM_OneCopy.py          # Manual run
│   └── migration_bom.log          # Logs for this task
│
└── 1C_PriceList/                  # Self-contained task folder
    ├── sql_queries.py             # SQL queries ONLY for PriceList
    ├── 1C_PriceList_CopyScript.py # Automatic (loop)
    ├── 1C_PriceList_OneCopy.py    # Manual run
    └── migration_pricelist.log    # Logs for this task
```

**Important:** Each task folder is **self-contained** and isolated:
- Has its own `sql_queries.py` with ONLY queries for that specific task
- Has its own copy scripts
- Has its own log file
- Independent from other tasks

### Two Script Types for Each Table

#### A. CopyScript (automatic, infinite loop)

**Purpose:** Runs continuously in background, periodically copies data

**Characteristics:**
- Infinite loop `while True`
- First run immediately on start
- Then pause (`time.sleep(SLEEP_SECONDS)`)
- Logging **only to file** (not to terminal)
- Uses `run_once()` function for one pass

**Structure:**
```python
def run_once():
    # Logic for one pass
    # Logging only via logging.info/error
    pass

if __name__ == "__main__":
    while True:
        try:
            run_once()
            logging.info(f"{datetime.now():%Y-%m-%d %H:%M:%S} update completed successfully.")
        except Exception as e:
            logging.error(f"error: {str(e)}")
        time.sleep(SLEEP_SECONDS)
```

#### B. OneCopy (manual run)

**Purpose:** One-time copy (manually, for large periods)

**Characteristics:**
- Runs once
- Output to **terminal** (print) + **logging**
- Shows execution progress
- Can configure date period for loading

**Structure:**
```python
def main():
    # Copy logic
    print("Fetching data from 1C...")
    logging.info(f"{datetime.now():%Y-%m-%d %H:%M:%S} update completed successfully.")
    pass

if __name__ == "__main__":
    main()
```

---

### Standard Python Script Logic

All scripts follow unified structure of **11 steps**:

#### 0. Imports (at top of script)
```python
import sys
import os

# Add parent directory to path for shared modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import shared modules from parent directory
from database_connector import get_connection
from database_Information import db_config_1c, db_config_myserver

# Import SQL queries from local sql_queries.py (same folder)
from sql_queries import QUERY_{TABLENAME}_TEMPLATE
```

#### 1. Database Connection
```python
conn_1c = get_connection(db_config_1c)       # 1C database (source)
conn_t  = get_connection(db_config_myserver) # Our DB (target)
cur_1c = conn_1c.cursor()
cur_t  = conn_t.cursor()
cur_t.execute("SET XACT_ABORT ON; SET LOCK_TIMEOUT 60000;")
```

#### 2. Define Period (only for window refresh)
```python
# For window refresh:
today = datetime.today().date()
date_to_real = today
date_from_real = today - timedelta(days=WINDOW_DAYS)  # e.g., 60 days

# Shift +2000 for 1C query
finish_4025 = dt_date(year=date_to_real.year + 2000, ...)
start_4025  = dt_date(year=date_from_real.year + 2000, ...)
```

#### 3. Query 1C
```python
# For window refresh:
query = QUERY_TEMPLATE.format(start_day=start_4025, finish_day=finish_4025)

# For full refresh:
query = QUERY_TEMPLATE  # without date parameters

cur_1c.execute(query)
columns_1c = [c[0] for c in cur_1c.description]
rows_1c = cur_1c.fetchall()
```

#### 4. Shift Dates by -2000 Years
```python
# For ALL date type fields (Start_Day, Finish_Day, OnlyDate, etc.)
def _shift_date_minus_2000(y):
    if y is None:
        return None
    return y.replace(year=y.year - 2000)

# Apply to needed fields
idx_date = columns_1c.index('OnlyDate')
for row in rows_1c:
    row = list(row)
    if isinstance(row[idx_date], dt_date):
        row[idx_date] = _shift_date_minus_2000(row[idx_date])
```

#### 5. Generate SnapshotID
```python
# Pattern 1 (window): one common SnapshotID
snapshot_id = _ensure_snapshot_id(cur_t)  # get existing or create new

# Pattern 2 (full): new every time
snapshot_id = str(uuid.uuid4())
```

#### 6. Clear Staging
```python
cur_t.execute(f"DELETE FROM {TABLE_STAGING} WHERE SnapshotID = ?", (snapshot_id,))
```

#### 7. Load to Staging
```python
insert_cols = ['SnapshotID'] + columns_1c
placeholders = ",".join(["?"] * len(insert_cols))
insert_sql = f"INSERT INTO {TABLE_STAGING} ({', '.join(insert_cols)}) VALUES ({placeholders})"

payload = [(snapshot_id,) + tuple(row) for row in rows_1c]
cur_t.fast_executemany = True
cur_t.executemany(insert_sql, payload)
```

#### 8. Deduplication (optional)
```python
# ONLY if deduplication needed (unique rows)
cur_t.execute(
    """
    ;WITH d AS (
      SELECT *,
             ROW_NUMBER() OVER (
               PARTITION BY {key_fields}  -- natural key
               ORDER BY (SELECT 0)
             ) AS rn
      FROM {TABLE_STAGING}
      WHERE SnapshotID = ?
    )
    DELETE FROM d WHERE rn > 1;
    """,
    (snapshot_id,)
)

# If deduplication NOT needed - skip this step
```

#### 9. Commit Staging
```python
conn_t.commit()
```

#### 10. Switch Snapshot
```python
# Pattern 1 (window):
cur_t.execute(
    "EXEC sp_SwitchSnapshot_{TableName} @SnapshotID=?, @DateFrom=?, @DateTo=?, @Full=0, @CleanupPrev=1",
    (snapshot_id, date_from_real, date_to_real)
)

# Pattern 2 (full):
cur_t.execute(
    "EXEC sp_SwitchSnapshot_{TableName} @SnapshotID=?, @Full=1, @CleanupPrev=1",
    (snapshot_id,)
)

conn_t.commit()
```

#### 11. Refresh Dependent Caches (optional)
```python
# Only if there are dependent tables/caches
for d in sorted(changed_dates):
    cur_t.execute("EXEC Production_TV.sp_Refresh_Cache_Plan_Base @date = ?", (d,))
    cur_t.execute("EXEC Production_TV.sp_Refresh_Cache_OrderSlots_Day @date = ?", (d,))
conn_t.commit()
```

---

## Example 1: Daily_PlanFact (Window Refresh)

### Characteristics

| Parameter | Value |
|----------|----------|
| **Pattern** | Window Refresh |
| **Date Field** | `OnlyDate` |
| **Window** | 60 days back from current date |
| **Frequency** | Every 60 seconds |
| **SnapshotID** | One common (reused) |
| **Deduplication** | Yes, required |
| **Natural Key** | `(OnlyDate, WorkCentorID, WorkNumberID, ProductionOrderID, NomenclatureID)` |

### SQL Structure

```sql
-- 1. Main table
CREATE TABLE Import_1C.Daily_PlanFact
(
    DocementID         varbinary(16),
    WorkCentorID       varbinary(16),
    WorkNumberID       varbinary(16),
    -- ... other fields ...
    OnlyDate           date,
    Plan_QTY           int,
    Scan_QTY           int,
    SnapshotID         uniqueidentifier NOT NULL
);

CREATE INDEX IX_Daily_PlanFact_SnapshotID
    ON Import_1C.Daily_PlanFact (SnapshotID);

-- IMPORTANT: Unique index (deduplication)
CREATE UNIQUE INDEX UX_Daily_PlanFact_Key
    ON Import_1C.Daily_PlanFact (SnapshotID, OnlyDate, WorkCentorID, WorkNumberID, ProductionOrderID, NomenclatureID);

-- 2. Staging table (identical structure)
CREATE TABLE Import_1C.stg_Daily_PlanFact
(
    -- Exactly same structure
);

-- 3. VIEW
CREATE VIEW Import_1C.vw_Daily_PlanFact_Current
AS
SELECT t.*
FROM Import_1C.Daily_PlanFact AS t
JOIN Import_1C.SnapshotPointer AS p
  ON p.TableName = 'Import_1C.Daily_PlanFact'
 AND t.SnapshotID = p.SnapshotID;

-- 4. Stored Procedure
CREATE PROC Import_1C.sp_SwitchSnapshot_Daily_PlanFact
  @SnapshotID   UNIQUEIDENTIFIER,
  @DateFrom     DATE = NULL,
  @DateTo       DATE = NULL,
  @Full         BIT  = 0,
  @CleanupPrev  BIT  = 1
AS
BEGIN
  -- Snapshot switching logic with window support
  -- See procedure code for details
END;
```

### Python Configuration

**File: `1C_PlanFact/sql_queries.py`** (in task folder)
```python
# sql_queries.py - queries for PlanFact ONLY

QUERY_DAILY_PLANFACT_TEMPLATE = """
-- SQL query to 1C with parameters {start_day} and {finish_day}
-- Returns data for period from start_day to finish_day
SELECT ... WHERE OnlyDate BETWEEN @StartDay AND @FinishDay
"""
```

**File: `1C_PlanFact/1C_PlanFactCopyScript.py`**
```python
# Imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from database_connector import get_connection
from database_Information import db_config_1c, db_config_myserver
from sql_queries import QUERY_DAILY_PLANFACT_TEMPLATE  # Local sql_queries.py

SLEEP_SECONDS = 60          # Every minute
WINDOW_DAYS = 60            # 60-day window
TABLE_STAGING = "Import_1C.stg_Daily_PlanFact"

def run_once():
    # 1. Connections
    # 2. Date window: today - 60 days (real dates)
    # 3. Shift +2000 for 1C query
    # 4. Query 1C
    # 5. Shift OnlyDate by -2000
    # 6. SINGLE SnapshotID via _ensure_snapshot_id()
    # 7. Clear staging
    # 8. Load to staging
    # 9. REQUIRED deduplication
    # 10. Commit staging
    # 11. Switch window (@Full=0)
    # 12. Refresh caches
    pass

if __name__ == "__main__":
    while True:
        run_once()
        logging.info("update completed successfully.")
        time.sleep(SLEEP_SECONDS)
```

### Key Points

1. **One SnapshotID** always: uses `_ensure_snapshot_id()` instead of `uuid.uuid4()`
2. **Deduplication required**: removes duplicates by natural key
3. **Unique index**: protection from accidental duplicates at DB level
4. **Window refresh**: `@Full=0, @DateFrom, @DateTo`
5. **Cache refresh**: additional procedures for dependent layers

---

## Example 2: Import_BOM (Full Refresh)

### Characteristics

| Parameter | Value |
|----------|----------|
| **Pattern** | Full Refresh |
| **Date Field** | `Start_Day`, `Finish_Day` (not for filtering) |
| **Window** | None, load everything |
| **Frequency** | Every 24 hours |
| **SnapshotID** | New on each run |
| **Deduplication** | No (copy all rows as-is) |
| **Natural Key** | None |

### SQL Structure

```sql
-- 1. Main table
CREATE TABLE Import_1C.Import_BOM
(
    Spec_ID                 varbinary(16),
    Nomencl_ID              varbinary(16),
    Colculet_ID             varbinary(16),
    -- ... other fields ...
    Start_Day               date,
    Finish_Day              date,
    BOM_No                  nvarchar(255),
    Material_Name           nvarchar(255),
    SnapshotID              uniqueidentifier NOT NULL
);

CREATE INDEX IX_Import_BOM_SnapshotID
    ON Import_1C.Import_BOM (SnapshotID);

-- IMPORTANT: NO unique index (duplicates allowed)
-- Only regular index for performance
CREATE INDEX IX_Import_BOM_Key
    ON Import_1C.Import_BOM (SnapshotID, Spec_ID, Nomencl_ID, Colculet_ID);

-- 2. Staging table (identical structure)
CREATE TABLE Import_1C.stg_Import_BOM
(
    -- Exactly same structure
);

-- 3. VIEW
CREATE VIEW Import_1C.vw_Import_BOM_Current
AS
SELECT t.*
FROM Import_1C.Import_BOM AS t
JOIN Import_1C.SnapshotPointer AS p
  ON p.TableName = 'Import_1C.Import_BOM'
 AND t.SnapshotID = p.SnapshotID;

-- 4. Stored Procedure
CREATE PROC Import_1C.sp_SwitchSnapshot_Import_BOM
  @SnapshotID   UNIQUEIDENTIFIER,
  @Full         BIT  = 1,
  @CleanupPrev  BIT  = 1
AS
BEGIN
  -- Snapshot switching logic (Full mode only)
  -- @DateFrom/@DateTo parameters not used
END;
```

### Python Configuration

**File: `1C_BOM/sql_queries.py`** (in task folder)
```python
# sql_queries.py - queries for BOM ONLY

QUERY_BOM_TEMPLATE = r"""
-- SQL query to 1C WITHOUT date parameters
-- Returns ALL rows
WITH Spec AS (
    SELECT ...
    FROM _Reference887_VT70029X1
    -- No WHERE by dates
)
SELECT * FROM Spec;
"""
```

**File: `1C_BOM/1C_BOM_CopyScript.py`**
```python
# Imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from database_connector import get_connection
from database_Information import db_config_1c, db_config_myserver
from sql_queries import QUERY_BOM_TEMPLATE  # Local sql_queries.py

SLEEP_SECONDS = 86400       # 24 hours
TABLE_STAGING = "Import_1C.stg_Import_BOM"

def run_once():
    # 1. Connections
    # 2. Query 1C (no dates)
    # 3. Shift Start_Day and Finish_Day by -2000
    # 4. NEW SnapshotID = uuid.uuid4()
    # 5. Clear staging
    # 6. Load to staging
    # 7. WITHOUT deduplication (skip)
    # 8. Commit staging
    # 9. Switch (@Full=1)
    # 10. No cache refresh
    pass

if __name__ == "__main__":
    # First run immediately
    run_once()
    
    # Then loop with 24-hour pause
    while True:
        time.sleep(SLEEP_SECONDS)
        run_once()
        logging.info("BOM: update successful.")
```

### Key Points

1. **New SnapshotID** every time: `uuid.uuid4()`
2. **WITHOUT deduplication**: all rows copied as-is
3. **NO unique index**: duplicates allowed
4. **Full refresh**: `@Full=1` (no dates)
5. **Date shift**: `Start_Day` and `Finish_Day` shifted by -2000
6. **No caches**: no dependent procedures

---

## Checklist for Adding New Table

### Step 1: Determine Pattern

**Questions:**
1. Does table have **date field** for filtering? 
   - Yes → **Pattern 1** (window refresh)
   - No → **Pattern 2** (full refresh)

2. Should rows be **unique**?
   - Yes → Need deduplication + unique index
   - No → Without deduplication, regular index

3. Which fields have **date** type?
   - All require -2000 years shift

---

### Step 2: SQL - Create Database Structure

#### 2.1. Main Table
```sql
CREATE TABLE Import_1C.{TableName}
(
    -- Business fields (from 1C query)
    Field1 type,
    Field2 type,
    -- ...
    
    -- Required:
    SnapshotID uniqueidentifier NOT NULL
);

-- Required index
CREATE INDEX IX_{TableName}_SnapshotID
    ON Import_1C.{TableName} (SnapshotID);

-- If deduplication needed:
CREATE UNIQUE INDEX UX_{TableName}_Key
    ON Import_1C.{TableName} (SnapshotID, {natural_key_fields});

-- If deduplication NOT needed:
CREATE INDEX IX_{TableName}_Key
    ON Import_1C.{TableName} (SnapshotID, {common_fields});
```

#### 2.2. Staging Table
```sql
CREATE TABLE Import_1C.stg_{TableName}
(
    -- Exactly same structure as main table
);

CREATE INDEX IX_stg_{TableName}_SnapshotID
    ON Import_1C.stg_{TableName} (SnapshotID);
```

#### 2.3. VIEW
```sql
CREATE VIEW Import_1C.vw_{TableName}_Current
AS
SELECT t.*
FROM Import_1C.{TableName} AS t
JOIN Import_1C.SnapshotPointer AS p
  ON p.TableName = 'Import_1C.{TableName}'
 AND t.SnapshotID = p.SnapshotID;
```

#### 2.4. Stored Procedure

**For Pattern 1 (window):** Copy `sp_SwitchSnapshot_Daily_PlanFact`, replace names

**For Pattern 2 (full):** Copy `sp_SwitchSnapshot_Import_BOM`, replace names

---

### Step 3: Python - Create sql_queries.py in Task Folder

**Create:** `1C_{TaskName}/sql_queries.py` with ONLY queries for this task.

**For window refresh (with date parameters):**
```python
# sql_queries.py - queries for {TaskName} ONLY

QUERY_{TABLENAME}_TEMPLATE = r"""
-- Your SQL query to 1C
DECLARE @StartDay  DATE = '{start_day}';
DECLARE @FinishDay DATE = '{finish_day}';

SELECT ...
WHERE DateField BETWEEN @StartDay AND @FinishDay;
"""
```

**For full refresh (without parameters):**
```python
# sql_queries.py - queries for {TaskName} ONLY

QUERY_{TABLENAME}_TEMPLATE = r"""
-- Your SQL query to 1C
SELECT ...
-- No WHERE by dates
"""
```

**IMPORTANT:** 
- Use `r"""` (raw string) to avoid backslash issues
- Each task folder has its own isolated `sql_queries.py`
- Do NOT create a common `sql_queries.py` in project root

---

### Step 4: Python - Create Copy Scripts

#### 4.1. CopyScript (automatic, infinite loop)

**For Pattern 1:** Copy `1C_PlanFactCopyScript.py`

**For Pattern 2:** Copy `1C_BOM_CopyScript.py`

**What to change:**
1. `TABLE_STAGING` → new staging table name
2. `QUERY_..._TEMPLATE` → your query from sql_queries.py
3. `SLEEP_SECONDS` → needed interval
4. `WINDOW_DAYS` → window width (Pattern 1 only)
5. Date field names for -2000 shift
6. Natural key in deduplication (Pattern 1 only)
7. Stored procedure name `sp_SwitchSnapshot_{TableName}`
8. Log file name (e.g. `migration_{tablename}.log`)

#### 4.2. OneCopy (manual run)

**For Pattern 1:** Copy `1C_PlanFactOneCopy.py`

**For Pattern 2:** Copy `1C_BOM_OneCopy.py`

**What to change:** Same as for CopyScript

---

### Step 5: Logging

**IMPORTANT for automatic scripts (CopyScript):**
- No `print()` - only `logging.info()` and `logging.error()`
- Log format: `{datetime} brief_message`

**For manual scripts (OneCopy):**
- Can use `print()` to show progress
- Also log via `logging`

```python
# CopyScript - logging only
logging.info(f"{datetime.now():%Y-%m-%d %H:%M:%S} update successful.")

# OneCopy - both print and logging
print(f"Rows received: {len(rows)}")
logging.info(f"{datetime.now():%Y-%m-%d %H:%M:%S} update successful.")
```

---

### Step 6: Testing

1. **Run OneCopy manually** for first load
2. **Check row count:**
   ```sql
   SELECT COUNT(*) FROM Import_1C.vw_{TableName}_Current;
   ```
3. **Check SnapshotPointer:**
   ```sql
   SELECT * FROM Import_1C.SnapshotPointer WHERE TableName = 'Import_1C.{TableName}';
   ```
4. **For deduplication - check duplicates:**
   ```sql
   SELECT {natural_key}, COUNT(*)
   FROM Import_1C.vw_{TableName}_Current
   GROUP BY {natural_key}
   HAVING COUNT(*) > 1;
   ```
5. **Run CopyScript** for automatic mode

---

## Additional Notes

### Date Shift by -2000 Years

**Rule:** ALL fields of `date` or `datetime` type from 1C require shift

```python
def _shift_date_minus_2000(y):
    if y is None:
        return None
    return y.replace(year=y.year - 2000)

# Apply to ALL date fields
for field_name in ['OnlyDate', 'Start_Day', 'Finish_Day', 'SomeDate']:
    if field_name in columns_1c:
        idx = columns_1c.index(field_name)
        # processing...
```

### NULL Value Handling

```python
# Check before shift
if row[idx] is not None and isinstance(row[idx], dt_date):
    row[idx] = _shift_date_minus_2000(row[idx])
```

### Performance

- Use `cur_t.fast_executemany = True` for bulk insert
- For large tables (>1M rows) consider batch insert
- Create indexes AFTER first data load

### Monitoring

Check logs regularly:
```bash
tail -f migration.log
tail -f migration_bom.log
```

### Rollback Changes

If need to return to previous snapshot:
```sql
-- Find needed SnapshotID in table
SELECT DISTINCT SnapshotID FROM Import_1C.{TableName};

-- Update pointer
UPDATE Import_1C.SnapshotPointer
SET SnapshotID = 'old-snapshot-id'
WHERE TableName = 'Import_1C.{TableName}';
```

---

## Summary

### Project Organization

**Each task = Isolated folder** with:
- ✅ Own `sql_queries.py` (only queries for this task)
- ✅ Own Python scripts (CopyScript, OneCopy)
- ✅ Own log file
- ✅ Independent from other tasks

**Shared modules** (in project root):
- `database_connector.py`
- `database_Information.py`

### Pattern 1: Window Refresh
- ✅ Has date field
- ✅ Large data
- ✅ Frequent updates
- ✅ Unique rows
- ✅ One SnapshotID
- ✅ Deduplication required

### Pattern 2: Full Refresh
- ✅ No date field (or not important)
- ✅ Small data
- ✅ Rare updates
- ✅ Duplicates allowed
- ✅ New SnapshotID each time
- ✅ Without deduplication

---

**Created:** 2026-01-19  
**Updated:** 2026-01-20  
**Version:** 1.1
