# import_timeloss.py
# -*- coding: utf-8 -*-
import os
import sys
import pyodbc
import pandas as pd
from datetime import datetime

# === НАСТРОЙКИ ===
DB_SERVER = "192.168.110.105"
DB_NAME   = "WeChat_APP"
DB_USER   = "pmc"
DB_PWD    = "pmc"

# Путь к файлу Excel
EXCEL_FILE = r"C:\Users\pphea\Documents\My progect\BIG_STATISTICS\Back\SQLscript\Entry.xlsx"
SHEET_NAME = "Лист1"

# Таблицы/поля в БД
TABLE_TIMELOSS = "[dbo].[TimeLoss]"  # целевая таблица
TABLE_DIRECTNESS = "[Ref].[Directness]"      # справочник направленности
COL_DIR_ID  = "DirectnessID"
COL_DIR_EN  = "DirectnessName_EN"
COL_DIR_ZH  = "DirectnessName_ZH"

TABLE_REASON = "[Ref].[ReasonGroup]"         # справочник причин (групп)
COL_RG_ID   = "ReasonGroupID"
COL_RG_EN   = "ReasonGroupName_EN"
COL_RG_ZH   = "ReasonGroupName_ZH"

# Ожидаемые столбцы во входном Excel:
# OnlyDate, WorkShopID, WorkCenterID,
# DirectnessID (или DirectnessEn/DirectnessZh),
# ReasonGroupID (или ReasonGroupEn/ReasonGroupZh),
# CommentText, ManHours, ActionPlan, Responsible, CompletedDate

def connect():
    # Пытаемся Driver 18, затем 17
    for drv in ("ODBC Driver 18 for SQL Server", "ODBC Driver 17 for SQL Server"):
        try:
            cn = pyodbc.connect(
                f"DRIVER={{{drv}}};SERVER={DB_SERVER};DATABASE={DB_NAME};UID={DB_USER};PWD={DB_PWD};"
                "TrustServerCertificate=yes;Encrypt=no",
                autocommit=False,
            )
            return cn
        except pyodbc.Error:
            continue
    raise RuntimeError("Нет подходящего ODBC драйвера (17/18). Установите Microsoft ODBC Driver for SQL Server.")

def norm_date(val):
    if pd.isna(val) or val == "":
        return None
    if isinstance(val, (pd.Timestamp, datetime)):
        return val.date().isoformat()
    # пробуем разные форматы
    s = str(val).strip()
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y", "%Y/%m/%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            pass
    # как fallback
    try:
        return pd.to_datetime(s).date().isoformat()
    except Exception:
        return s  # оставим как есть — БД всё равно скажет, если не дата

def fetch_dict_map(cursor, table, id_col, en_col, zh_col):
    sql = f"SELECT {id_col}, {en_col}, {zh_col} FROM {table}"
    m = {}
    cursor.execute(sql)
    for rid, en, zh in cursor.fetchall():
        if en is not None:
            m[str(en).strip().lower()] = rid
        if zh is not None:
            m[str(zh).strip().lower()] = rid
        # также дадим прямой доступ по самому ID (строкой)
        m[str(rid).strip().lower()] = rid
    return m

def resolve_id(row, id_field, en_field, zh_field, dict_map, dict_name):
    """
    Возвращает ID по приоритету:
    1) явный *ID* столбец, если есть и не пустой
    2) zh-название
    3) en-название
    """
    # явный ID
    if id_field in row and pd.notna(row[id_field]) and str(row[id_field]).strip() != "":
        key = str(row[id_field]).strip().lower()
        return dict_map.get(key), None  # None = нет ошибки

    # zh
    if zh_field in row and pd.notna(row[zh_field]) and str(row[zh_field]).strip() != "":
        key = str(row[zh_field]).strip().lower()
        if key in dict_map:
            return dict_map[key], None
        return None, f"{dict_name}: не найдено по ZH '{row[zh_field]}'"

    # en
    if en_field in row and pd.notna(row[en_field]) and str(row[en_field]).strip() != "":
        key = str(row[en_field]).strip().lower()
        if key in dict_map:
            return dict_map[key], None
        return None, f"{dict_name}: не найдено по EN '{row[en_field]}'"

    return None, f"{dict_name}: пустое значение (нет ID/EN/ZH)"

def main():
    if not os.path.exists(EXCEL_FILE):
        print(f"Файл не найден: {EXCEL_FILE}")
        sys.exit(1)

    print("Читаю Excel…")
    df = pd.read_excel(EXCEL_FILE, sheet_name=SHEET_NAME)

    # Подчистим названия колонок (лишние пробелы)
    df.columns = [c.strip() for c in df.columns]

    # Подключение
    cn = connect()
    cur = cn.cursor()

    # Карты соответствия названий EN/ZH → ID
    print("Гружу справочники…")
    dir_map = fetch_dict_map(cur, TABLE_DIRECTNESS, COL_DIR_ID, COL_DIR_EN, COL_DIR_ZH)
    rg_map  = fetch_dict_map(cur, TABLE_REASON,     COL_RG_ID,  COL_RG_EN,  COL_RG_ZH)

    # Подготовим данные к вставке
    required = ["OnlyDate", "WorkShopID", "WorkCenterID", "ManHours"]
    out_rows = []
    errors = []

    for idx, row in df.iterrows():
        r = {k: row.get(k, None) for k in df.columns}

        # --- даты
        only_date = norm_date(r.get("OnlyDate"))
        completed = norm_date(r.get("CompletedDate"))

        # --- справочники
        directness_id, e1 = resolve_id(r,
                                       "DirectnessID",
                                       "DirectnessEn", "DirectnessZh",
                                       dir_map, "Directness")
        reason_id, e2 = resolve_id(r,
                                   "ReasonGroupID",
                                   "ReasonGroupEn", "ReasonGroupZh",
                                   rg_map, "ReasonGroup")

        # --- обязательные поля
        ws_id = r.get("WorkShopID")
        wc_id = r.get("WorkCenterID")
        man_hours = r.get("ManHours")

        missing = []
        for col in required:
            v = {"OnlyDate": only_date, "WorkShopID": ws_id, "WorkCenterID": wc_id, "ManHours": man_hours}[col]
            if v is None or str(v).strip() == "":
                missing.append(col)

        err_msgs = []
        if e1: err_msgs.append(e1)
        if e2: err_msgs.append(e2)
        if missing:
            err_msgs.append("Пустые обязательные поля: " + ", ".join(missing))

        if err_msgs:
            bad = dict(row)
            bad["_ERROR"] = " | ".join(err_msgs)
            errors.append(bad)
            continue

        # --- прочие поля
        comment = r.get("CommentText")
        action  = r.get("ActionPlan")
        resp    = r.get("Responsible")

        # Запись к вставке (EntryID автогенерится в БД)
        out_rows.append((
            only_date,
            ws_id,
            wc_id,
            int(directness_id),
            int(reason_id),
            comment,
            float(man_hours) if pd.notna(man_hours) and str(man_hours) != "" else None,
            action,
            resp,
            completed
        ))

    if errors:
        pd.DataFrame(errors).to_csv("import_errors.csv", index=False, encoding="utf-8-sig")
        print(f"⚠️ Строк с ошибками: {len(errors)} (сохранены в import_errors.csv)")

    if not out_rows:
        print("Нет корректных строк для вставки — выходим.")
        cn.close()
        return

    # Вставка пачкой
    print(f"Вставляю в {TABLE_TIMELOSS}: {len(out_rows)} строк…")
    insert_sql = f"""
    INSERT INTO {TABLE_TIMELOSS}
    (OnlyDate, WorkShopID, WorkCenterID, DirectnessID, ReasonGroupID,
     CommentText, ManHours, ActionPlan, Responsible, CompletedDate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    try:
        cur.fast_executemany = True
        cur.executemany(insert_sql, out_rows)
        cn.commit()
        print("✅ Готово!")
    except Exception as e:
        cn.rollback()
        print("❌ Ошибка при вставке:", e)
        raise
    finally:
        cn.close()

if __name__ == "__main__":
    main()
