"""Syncs employee info from SKUD into Import_SKUD.empinfo via MERGE (every 2 minutes)."""
import sys
import os

_MIG_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, _MIG_ROOT)
sys.path.insert(0, os.path.dirname(__file__))

from core.base import BaseMigration
from core.db import get_skud_connection, get_target_connection
from sql import QUERY_empinfo

SCHEMA     = 'Import_SKUD'
TABLE_NAME = 'empinfo'
FULL_TABLE = f'[{SCHEMA}].[{TABLE_NAME}]'

COLUMNS = [
    ('empcode',    'NVARCHAR(50)'),
    ('empname',    'NVARCHAR(100)'),
    ('birthday',   'SMALLDATETIME'),
    ('age',        'SMALLINT'),
    ('entrydate',  'SMALLDATETIME'),
    ('emptype',    'NVARCHAR(100)'),
    ('isactive',   'BIT'),
    ('deptname2',  'NVARCHAR(200)'),
    ('deptname3',  'NVARCHAR(200)'),
    ('deptname4',  'NVARCHAR(200)'),
    ('deptname5',  'NVARCHAR(200)'),
]


def _ensure_schema_exists(cur_target):
    cur_target.execute(f"""
        IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = '{SCHEMA}')
        BEGIN
            EXEC('CREATE SCHEMA {SCHEMA}')
        END
    """)


def _ensure_table_exists(cur_target):
    cols_sql = ", ".join(f"[{name}] {dtype}" for name, dtype in COLUMNS)
    cur_target.execute(f"""
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES
                       WHERE TABLE_SCHEMA = '{SCHEMA}'
                       AND TABLE_NAME = '{TABLE_NAME}')
        BEGIN
            CREATE TABLE {FULL_TABLE} (
                {cols_sql},
                LastUpdated DATETIME DEFAULT GETDATE(),
                CONSTRAINT PK_{TABLE_NAME} PRIMARY KEY (empcode)
            );
            CREATE INDEX IX_{TABLE_NAME}_isactive ON {FULL_TABLE}(isactive);
            CREATE INDEX IX_{TABLE_NAME}_deptname2 ON {FULL_TABLE}(deptname2);
        END
    """)


class EmpinfoCopy(BaseMigration):
    script_id        = "skud_empinfo"
    script_name      = "SKUD Empinfo"
    interval_seconds = 120
    category         = "continuous"

    def run_once(self) -> int:
        conn_src = conn_target = cur_src = cur_target = None
        try:
            conn_src    = get_skud_connection()
            conn_target = get_target_connection()
            cur_src     = conn_src.cursor()
            cur_target  = conn_target.cursor()

            _ensure_schema_exists(cur_target)
            _ensure_table_exists(cur_target)
            conn_target.commit()

            cur_src.execute(QUERY_empinfo)
            rows = cur_src.fetchall()

            if not rows:
                return 0

            src_cols = [d[0] for d in cur_src.description]
            idx_map  = [src_cols.index(c[0]) for c in COLUMNS]
            data     = [tuple(row[i] for i in idx_map) for row in rows]

            col_names  = [c[0] for c in COLUMNS]
            col_list   = ", ".join(f"[{c}]" for c in col_names)
            param_list = ", ".join("?" * len(COLUMNS))
            update_set = ", ".join(f"target.[{c}] = source.[{c}]" for c in col_names if c != 'empcode')

            merge_sql = f"""
            MERGE {FULL_TABLE} AS target
            USING (VALUES ({param_list})) AS source ({col_list})
            ON target.empcode = source.empcode
            WHEN MATCHED THEN
                UPDATE SET {update_set}, LastUpdated = GETDATE()
            WHEN NOT MATCHED THEN
                INSERT ({col_list}, LastUpdated)
                VALUES ({param_list}, GETDATE());
            """

            for row in data:
                cur_target.execute(merge_sql, row + row)

            conn_target.commit()

            return len(data)

        finally:
            for obj in [cur_src, cur_target, conn_src, conn_target]:
                try:
                    if obj:
                        obj.close()
                except Exception:
                    pass


if __name__ == "__main__":
    EmpinfoCopy().run()
