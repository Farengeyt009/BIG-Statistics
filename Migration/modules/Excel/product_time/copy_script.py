"""Product Time Excel Sync — watches handbook xlsx for changes and uploads to Ref schema (every 60 s)."""
import sys
import os
import math

_MIG_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, _MIG_ROOT)

import pandas as pd

from core.base import BaseMigration
from core.db import get_target_connection

EXCEL_PATH = r'\\192.168.110.14\departments\Planning\Work\Aikerim\成品型式手册Справочник Моделей.xlsx'

_last_mtime: float = 0.0


def _coerce(v):
    """Convert pandas NaN / float NaN to None for pyodbc."""
    if v is None:
        return None
    try:
        if math.isnan(v):
            return None
    except TypeError:
        pass
    return v


def _read_product_guide() -> pd.DataFrame:
    col_map = {
        'Workshop':             'Workshop',
        'Factory number':       'FactoryNumber',
        'Large Group':          'LargeGroup',
        'System Name':          'SystemName',
        'Brand':                'Brand',
        'Factory Name Briefly': 'FactoryNameBriefly',
        'Customer Name':        'CustomerName',
        'Group':                'GroupName',
        'Head and other':       'HeadAndOther',
        'Power':                'Power',
        'Firmware':             'Firmware',
        'Displacement':         'Displacement',
    }
    df = pd.read_excel(EXCEL_PATH, sheet_name='Sheet1', usecols=range(12), dtype=str,
                       keep_default_na=False)

    missing = set(col_map.keys()) - set(df.columns)
    if missing:
        raise ValueError(f"[Sheet1] Missing columns in Excel: {missing}")

    df.rename(columns=col_map, inplace=True)
    df = df[list(col_map.values())]
    df = df[~df.apply(lambda r: r.str.strip().eq('').all(), axis=1)]
    df = df.replace({'': None})
    return df.reset_index(drop=True)


def _read_timeloss_guide() -> pd.DataFrame:
    df = pd.read_excel(EXCEL_PATH, sheet_name='WorkShop Name',
                       usecols='A:D', header=0, dtype=str, keep_default_na=False)
    df.columns = ['WorkShop_TimeLoss', 'Line_Name_TimeLoss',
                  'WorkShop_PowerQuery', 'Line_Name_PowerQuery']
    df = df[df['WorkShop_TimeLoss'].str.strip() != ''].reset_index(drop=True)
    return df.replace({'': None})


def _read_1c_guide() -> pd.DataFrame:
    df = pd.read_excel(EXCEL_PATH, sheet_name='WorkShop Name',
                       usecols='F:I', header=0, dtype=str, keep_default_na=False)
    df.columns = ['WorkShop_1C', 'Line_Name_1C',
                  'WorkShop_PowerQuery', 'Line_Name_PowerQuery']
    df = df[df['WorkShop_1C'].str.strip() != ''].reset_index(drop=True)
    return df.replace({'': None})


def _upload(cur, table: str, df: pd.DataFrame) -> None:
    cols          = list(df.columns)
    placeholders  = ', '.join(['?'] * len(cols))
    insert_sql    = f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({placeholders})"

    cur.execute(f"TRUNCATE TABLE {table}")

    rows = [tuple(_coerce(v) for v in row) for row in df.itertuples(index=False, name=None)]
    cur.fast_executemany = True
    cur.executemany(insert_sql, rows)


class ProductTimeCopy(BaseMigration):
    script_id        = "excel_product_time"
    script_name      = "Product Time Excel Sync"
    interval_seconds = 60
    category         = "continuous"

    def run_once(self) -> int:
        global _last_mtime

        try:
            mtime = os.path.getmtime(EXCEL_PATH)
        except OSError as e:
            raise FileNotFoundError(f"Excel file not accessible: {EXCEL_PATH}") from e

        if mtime <= _last_mtime:
            return 0

        df_product  = _read_product_guide()
        df_timeloss = _read_timeloss_guide()
        df_1c       = _read_1c_guide()

        conn = get_target_connection()
        try:
            cur = conn.cursor()
            cur.execute("SET XACT_ABORT ON;")
            _upload(cur, "Ref.Product_Guide",           df_product)
            _upload(cur, "Ref.WorkShop_TimeLoss_Guide", df_timeloss)
            _upload(cur, "Ref.WorkShop_1C_Guide",       df_1c)
            conn.commit()
        finally:
            try:
                cur.close()
            except Exception:
                pass
            try:
                conn.close()
            except Exception:
                pass

        _last_mtime = mtime
        return len(df_product) + len(df_timeloss) + len(df_1c)


if __name__ == "__main__":
    ProductTimeCopy().run()
