# timeloss_entry_loader.py
# Usage:
#   python timeloss_entry_loader.py
#
# Требует pyodbc и pandas: pip install pyodbc pandas
#
# ПЕРЕД ЗАПУСКОМ НАСТРОЙТЕ ПАРАМЕТРЫ ПОДКЛЮЧЕНИЯ К БД:
# - DB_SERVER: адрес вашего SQL Server (например: localhost, 192.168.1.100)
# - DB_DATABASE: название базы данных
# - DB_UID: имя пользователя
# - DB_PWD: пароль
#
# Или настройте переменные окружения:
#   DB_SERVER, DB_DATABASE, DB_UID, DB_PWD

import os
import sys
import pyodbc
import pandas as pd
from decimal import Decimal, ROUND_HALF_UP
from typing import Tuple, Dict, List, Any, Optional

# ====== ПОДКЛЮЧЕНИЕ К БД ======
# Настройки подключения к базе данных
DB_DRIVER = "{ODBC Driver 18 for SQL Server}"  # Используем драйвер 18
DB_SERVER = "localhost"  # Или IP вашего SQL Server
DB_DATABASE = "BIG_STATISTICS"  # Или название вашей БД
DB_UID = "sa"  # Или ваш пользователь
DB_PWD = "your_password"  # Ваш пароль

# Можно переопределить через переменные окружения
DB_DRIVER = os.getenv("DB_DRIVER", DB_DRIVER)
DB_SERVER = os.getenv("DB_SERVER", DB_SERVER)
DB_DATABASE = os.getenv("DB_DATABASE", DB_DATABASE)
DB_UID = os.getenv("DB_UID", DB_UID)
DB_PWD = os.getenv("DB_PWD", DB_PWD)

CONN_STR = (
    f"DRIVER={DB_DRIVER};SERVER={DB_SERVER};DATABASE={DB_DATABASE};"
    f"UID={DB_UID};PWD={DB_PWD};TrustServerCertificate=Yes;MARS_Connection=Yes;"
)

# ====== УТИЛИТЫ ======
def _norm(s: Optional[str]) -> str:
    return (s or "").strip().lower()

def to_date(x) -> Optional[pd.Timestamp]:
    if pd.isna(x) or x is None:
        return None
    try:
        # Excel уже нормализован, но на всякий случай
        return pd.to_datetime(x).date()
    except Exception:
        return None

def to_decimal_nonneg(x) -> Optional[Decimal]:
    if pd.isna(x) or x is None or str(x).strip() == "":
        return None
    try:
        d = Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return d if d >= 0 else Decimal("0")
    except Exception:
        return None

# ====== ЗАГРУЗКА СПРАВОЧНИКОВ ======
def load_directness_map(cur) -> Dict[str, int]:
    """
    Ключи: нормализованные EN/ZH названия → DirectnessID
    """
    cur.execute("""
        SELECT DirectnessID,
               LTRIM(RTRIM(COALESCE(Name_EN, ''))) AS Name_EN,
               LTRIM(RTRIM(COALESCE(Name_ZH, ''))) AS Name_ZH
        FROM Ref.Directness WITH (NOLOCK)
    """)
    mp: Dict[str, int] = {}
    for did, en, zh in cur.fetchall():
        if en: mp[_norm(en)] = did
        if zh: mp[_norm(zh)] = did
    return mp

def load_reason_group_map(cur) -> Dict[Tuple[str, str], int]:
    """
    Ключи: (WorkShopID, нормализованное EN/ZH название) → ReasonGroupID
    """
    cur.execute("""
        SELECT ReasonGroupID,
               LTRIM(RTRIM(COALESCE(WorkShopID, ''))) AS WorkShopID,
               LTRIM(RTRIM(COALESCE(Name_EN, '')))     AS Name_EN,
               LTRIM(RTRIM(COALESCE(Name_ZH, '')))     AS Name_ZH
        FROM Ref.ReasonGroup WITH (NOLOCK)
    """)
    mp: Dict[Tuple[str, str], int] = {}
    for rgid, wsid, en, zh in cur.fetchall():
        if not wsid:
            continue
        if en:
            mp[(wsid, _norm(en))] = rgid
        if zh:
            mp[(wsid, _norm(zh))] = rgid
    return mp

# ====== ПОДГОТОВКА СТРОК К ВСТАВКЕ ======
def prepare_rows(df: pd.DataFrame,
                 dir_map: Dict[str, int],
                 rg_map: Dict[Tuple[str, str], int]) -> Tuple[List[tuple], List[dict]]:
    """
    Возвращает:
      ok_rows: список кортежей для INSERT
      bad_rows: список описаний ошибок для отчёта
    """
    ok_rows: List[tuple] = []
    bad_rows: List[dict] = []

    required_cols = [
        "OnlyDate", "WorkShopID", "WorkCenterID",
        "DirectnessZh", "DirectnessEn",
        "ReasonGroupZh", "ReasonGroupEn",
        "CommentText", "ManHours", "ActionPlan", "Responsible", "CompletedDate"
    ]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"В Excel нет колонок: {missing}")

    for i, r in df.iterrows():
        only_date = to_date(r["OnlyDate"])
        wsid = str(r["WorkShopID"]).strip()
        wcid = str(r["WorkCenterID"]).strip()

        d_en = _norm(r.get("DirectnessEn"))
        d_zh = _norm(r.get("DirectnessZh"))
        did = dir_map.get(d_en) or dir_map.get(d_zh)

        rg_en = _norm(r.get("ReasonGroupEn"))
        rg_zh = _norm(r.get("ReasonGroupZh"))
        rgid = rg_map.get((wsid, rg_en)) or rg_map.get((wsid, rg_zh))

        comment = (r.get("CommentText") or "").strip()
        action = (r.get("ActionPlan") or None)
        resp = (r.get("Responsible") or None)
        comp_date = to_date(r.get("CompletedDate"))
        mh = to_decimal_nonneg(r.get("ManHours"))

        errs = []
        if not only_date: errs.append("OnlyDate")
        if not wsid: errs.append("WorkShopID")
        if not wcid: errs.append("WorkCenterID")
        if not did: errs.append("DirectnessID (по названию не найден)")
        if not rgid: errs.append("ReasonGroupID (по названию+цех не найден)")
        if mh is None: errs.append("ManHours")

        if errs:
            bad_rows.append({"row": int(i), "errors": "; ".join(errs)})
            continue

        ok_rows.append((
            only_date,         # OnlyDate (date)
            wsid,              # WorkShopID (nvarchar)
            wcid,              # WorkCenterID (nvarchar)
            int(did),          # DirectnessID (int)
            int(rgid),         # ReasonGroupID (int)
            (comment if comment != "" else None),  # CommentText (nullable)
            float(mh),         # ManHours (decimal → float ok)
            (action if action not in ("", None) else None),  # ActionPlan
            (resp if resp not in ("", None) else None),      # Responsible
            comp_date          # CompletedDate (date, nullable)
        ))

    return ok_rows, bad_rows

# ====== ВСТАВКА ======
def insert_rows(cur, rows: List[tuple]) -> None:
    if not rows:
        return
    cur.fast_executemany = True
    cur.executemany("""
        INSERT INTO [TimeLoss].[Entry]
            (OnlyDate, WorkShopID, WorkCenterID, DirectnessID, ReasonGroupID,
             CommentText, ManHours, ActionPlan, Responsible, CompletedDate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, rows)

# ====== ОСНОВНОЙ ПРОЦЕСС ======
def process_files(paths: List[str]) -> None:
    print("Подключение к базе данных...")
    print(f"Сервер: {DB_SERVER}")
    print(f"База данных: {DB_DATABASE}")
    print(f"Пользователь: {DB_UID}")
    print(f"Драйвер: {DB_DRIVER}")
    print()
    
    try:
        with pyodbc.connect(CONN_STR) as conn:
            print("✅ Подключение к БД успешно!")
            cur = conn.cursor()
            dir_map = load_directness_map(cur)
            rg_map = load_reason_group_map(cur)

        total_ok = 0
        errors_all: List[dict] = []
        batch: List[tuple] = []

        for p in paths:
            df = pd.read_excel(p, sheet_name=0)
            ok, bad = prepare_rows(df, dir_map, rg_map)
            total_ok += len(ok)
            errors_all.extend([{"file": os.path.basename(p), **e} for e in bad])
            batch.extend(ok)

        if batch:
            insert_rows(cur, batch)
            conn.commit()

        print(f"OK inserted: {total_ok}")
        print(f"Rejected:   {len(errors_all)}")

        if errors_all:
            rep = pd.DataFrame(errors_all)
            out_name = "timeloss_entry_loader_errors.csv"
            rep.to_csv(out_name, index=False, encoding="utf-8-sig")
            print(f"Errors saved to {out_name}")
    
    except pyodbc.Error as e:
        print(f"❌ Ошибка подключения к БД: {e}")
        print("\nПроверьте настройки подключения в скрипте:")
        print(f"  - Сервер: {DB_SERVER}")
        print(f"  - База данных: {DB_DATABASE}")
        print(f"  - Пользователь: {DB_UID}")
        print(f"  - Драйвер: {DB_DRIVER}")
        print("\nИли настройте переменные окружения:")
        print("  DB_SERVER, DB_DATABASE, DB_UID, DB_PWD")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Неожиданная ошибка: {e}")
        sys.exit(1)

def get_excel_files_from_script_folder() -> List[str]:
    """
    Автоматически находит все Excel файлы в папке скрипта
    """
    script_dir = r"C:\Users\pphea\Documents\My progect\BIG_STATISTICS\Back\SQLscript"
    excel_files = []
    
    if os.path.exists(script_dir):
        for file in os.listdir(script_dir):
            if file.lower().endswith(('.xlsx', '.xls')):
                excel_files.append(os.path.join(script_dir, file))
    
    return excel_files

if __name__ == "__main__":
    # Автоматически находим Excel файлы в папке скрипта
    excel_files = get_excel_files_from_script_folder()
    
    if not excel_files:
        print("Excel файлы не найдены в папке:")
        print(r"C:\Users\pphea\Documents\My progect\BIG_STATISTICS\Back\SQLscript")
        print("\nУбедитесь, что Excel файлы находятся в этой папке.")
        sys.exit(1)
    
    print(f"Найдены Excel файлы:")
    for file in excel_files:
        print(f"  - {os.path.basename(file)}")
    print()
    
    # Обрабатываем все найденные файлы
    process_files(excel_files)
