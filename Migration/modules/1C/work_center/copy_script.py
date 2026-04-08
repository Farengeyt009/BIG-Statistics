"""Copies WorkCenter_1C from 1C into the target DB (full table replace, scheduled)."""
import sys
import os

_MIG_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, _MIG_ROOT)
sys.path.insert(0, os.path.dirname(__file__))

from core.base import BaseMigration
from core.db import get_1c_connection, get_target_connection
from sql import QUERY_WORKCENTER_1C

SCHEMA     = 'Import_1C'
TABLE_NAME = 'WorkCenter_1C'
FULL_TABLE = f'[{SCHEMA}].[{TABLE_NAME}]'

COLUMNS = [
    ('WorkShop_ID',          'VARBINARY(16)'),
    ('WorkCenter_Type_ID',   'VARBINARY(16)'),
    ('WorkCenter_ID',        'VARBINARY(16)'),
    ('WorkShop_Ru',          'NVARCHAR(100)'),
    ('WorkShop_Cn',          'NVARCHAR(100)'),
    ('WorkCenter_Type_Ru',   'NVARCHAR(100)'),
    ('WorkCenter_Type_Cn',   'NVARCHAR(100)'),
    ('WorkCenter_Ru',        'NVARCHAR(150)'),
    ('WorkCenter_Cn',        'NVARCHAR(150)'),
]


class WorkCenterCopy(BaseMigration):
    script_id        = "1c_work_center"
    script_name      = "1C WorkCenter (full replace, scheduled)"
    interval_seconds = 86400
    category         = "scheduled"

    def run_once(self) -> int:
        conn_src = conn_target = cur_src = cur_target = None
        try:
            conn_src    = get_1c_connection()
            conn_target = get_target_connection()

            cur_src = conn_src.cursor()
            cur_src.execute(QUERY_WORKCENTER_1C)
            rows = cur_src.fetchall()

            if not rows:
                return 0

            cols_sql  = ", ".join(f"[{n}] {t}" for n, t in COLUMNS)
            cur_target = conn_target.cursor()
            cur_target.execute(
                f"IF OBJECT_ID(N'{FULL_TABLE}', 'U') IS NOT NULL "
                f"DROP TABLE {FULL_TABLE};"
                f"CREATE TABLE {FULL_TABLE} ({cols_sql});"
            )

            src_cols = [d[0] for d in cur_src.description]
            idx_map  = [src_cols.index(c[0]) for c in COLUMNS]

            data = [tuple(row[i] for i in idx_map) for row in rows]

            placeholders = ", ".join("?" for _ in COLUMNS)
            sql_insert   = f"INSERT INTO {FULL_TABLE} VALUES ({placeholders})"
            cur_target.fast_executemany = True
            cur_target.executemany(sql_insert, data)
            conn_target.commit()

            return len(data)
        finally:
            for obj in [cur_src, cur_target, conn_src, conn_target]:
                try:
                    if obj: obj.close()
                except Exception:
                    pass


if __name__ == "__main__":
    WorkCenterCopy().run_once_standalone()
