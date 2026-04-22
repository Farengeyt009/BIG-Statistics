"""Month Plan Excel Sync — watches PlanDATA.xlsx for changes and uploads to Plan schema (every 60 s)."""
import sys
import os
import math

_MIG_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, _MIG_ROOT)

import pandas as pd

from core.base import BaseMigration
from core.db import get_target_connection

EXCEL_PATH = r'\\192.168.110.14\departments\Planning\Work\Aikerim\PlanDATA.xlsx'

COLUMN_MAPPING = {
    'Date':              'PlanDate',
    'Line':              'Line',
    'Factory number':    'FactoryNumber',
    'Name':              'Name',
    'PI.NO':             'PINumber',
    'Month Plan, pcs':   'MonthPlanPcs',
    'Labor intensity':   'LaborIntensity',
    'Time Fund MP':      'TimeFundMP',
    'Staff MP':          'StaffMP',
    'Large Group':       'LargeGroup',
    'Order region':      'OrderRegion',
}

DB_COLUMNS = ['PlanDate', 'Line', 'FactoryNumber', 'Name', 'PINumber',
              'MonthPlanPcs', 'LaborIntensity', 'TimeFundMP', 'StaffMP',
              'LargeGroup', 'OrderRegion']

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


def _read_sheet(sheet_name: str, usecols) -> pd.DataFrame:
    df = pd.read_excel(EXCEL_PATH, sheet_name=sheet_name, usecols=usecols)

    missing = set(COLUMN_MAPPING.keys()) - set(df.columns)
    if missing:
        raise ValueError(f"[{sheet_name}] Missing columns in Excel: {missing}")

    df.rename(columns=COLUMN_MAPPING, inplace=True)
    df.dropna(how='all', inplace=True)
    df = df.dropna(subset=['FactoryNumber'])
    df = df[df['FactoryNumber'].astype(str).str.strip() != '']

    df['LaborIntensity'] = pd.to_numeric(df['LaborIntensity'], errors='coerce').round(4)
    df['TimeFundMP']     = pd.to_numeric(df['TimeFundMP'],     errors='coerce').round(4)
    df['PlanDate']       = df['PlanDate'].astype(str)

    return df[DB_COLUMNS].reset_index(drop=True)


def _upload(cur, table: str, df: pd.DataFrame) -> None:
    placeholders = ', '.join(['?'] * len(DB_COLUMNS))
    cols_str     = ', '.join(DB_COLUMNS)
    insert_sql   = f"INSERT INTO {table} ({cols_str}) VALUES ({placeholders})"

    cur.execute(f"TRUNCATE TABLE {table}")

    rows = [tuple(_coerce(v) for v in row) for row in df.itertuples(index=False, name=None)]
    cur.fast_executemany = True
    cur.executemany(insert_sql, rows)


class PlanMonthCopy(BaseMigration):
    script_id        = "excel_plan_month"
    script_name      = "Month Plan Excel Sync"
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

        df_heaters = _read_sheet('Heaters', range(11))
        df_wh      = _read_sheet('WH',      range(1, 12))

        conn = get_target_connection()
        try:
            cur = conn.cursor()
            cur.execute("SET XACT_ABORT ON;")
            _upload(cur, "Plan.Month_Plan_Heaters", df_heaters)
            _upload(cur, "Plan.Month_Plan_WH",      df_wh)
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
        return len(df_heaters) + len(df_wh)


if __name__ == "__main__":
    PlanMonthCopy().run()
