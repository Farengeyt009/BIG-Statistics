"""Labor Cost Copy Script — full refresh every hour."""
import sys
import os
_MIG_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, _MIG_ROOT)
sys.path.insert(0, os.path.dirname(__file__))

import uuid
from datetime import datetime, date as dt_date
from core.base import BaseMigration
from core.db import get_1c_connection, get_target_connection
from sql import QUERY_LABOR_COST_TEMPLATE


class LaborCostCopy(BaseMigration):
    script_id        = "1c_labor_cost"
    script_name      = "Labor Cost Copy (1C)"
    interval_seconds = 3600
    category         = "continuous"

    TABLE_STAGING = "Import_1C.stg_Labor_Cost"

    def run_once(self) -> int:
        conn_1c = conn_t = cur_1c = cur_t = None
        try:
            conn_1c = get_1c_connection()
            conn_t  = get_target_connection()
            cur_1c  = conn_1c.cursor()
            cur_t   = conn_t.cursor()
            cur_t.execute("SET XACT_ABORT ON; SET LOCK_TIMEOUT 60000;")

            cur_1c.execute(QUERY_LABOR_COST_TEMPLATE)
            columns_1c = [c[0] for c in cur_1c.description]
            rows_1c    = cur_1c.fetchall()

            if not rows_1c:
                return 0

            idx_date = columns_1c.index('Date')
            rows_shifted = []
            for row in rows_1c:
                row = list(row)
                if isinstance(row[idx_date], dt_date):
                    row[idx_date] = row[idx_date].replace(year=row[idx_date].year - 2000)
                rows_shifted.append(tuple(row))

            snapshot_id = str(uuid.uuid4())
            cur_t.execute(f"DELETE FROM {self.TABLE_STAGING} WHERE SnapshotID = ?", (snapshot_id,))

            insert_cols  = ['SnapshotID'] + columns_1c
            placeholders = ",".join(["?"] * len(insert_cols))
            insert_sql   = f"INSERT INTO {self.TABLE_STAGING} ({', '.join(insert_cols)}) VALUES ({placeholders})"
            payload = [(snapshot_id,) + tuple(row) for row in rows_shifted]
            cur_t.fast_executemany = True
            cur_t.executemany(insert_sql, payload)
            conn_t.commit()

            cur_t.execute(
                "EXEC Import_1C.sp_SwitchSnapshot_Labor_Cost @SnapshotID=?, @Full=1, @CleanupPrev=1",
                (snapshot_id,)
            )
            conn_t.commit()
            return len(rows_shifted)
        finally:
            for obj in (cur_1c, cur_t, conn_1c, conn_t):
                try:
                    if obj: obj.close()
                except Exception:
                    pass


if __name__ == "__main__":
    LaborCostCopy().run()
