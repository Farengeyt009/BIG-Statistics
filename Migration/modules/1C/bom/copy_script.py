"""BOM Copy Script — full refresh every 24 hours."""
import sys
import os
_MIG_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, _MIG_ROOT)
sys.path.insert(0, os.path.dirname(__file__))  # for local sql.py

import uuid
from datetime import datetime, date as dt_date
from core.base import BaseMigration
from core.db import get_1c_connection, get_target_connection
from sql import QUERY_BOM_TEMPLATE


def _shift_date_minus_2000(y):
    if y is None:
        return None
    return y.replace(year=y.year - 2000)


class BomCopy(BaseMigration):
    script_id        = "1c_bom"
    script_name      = "BOM Copy (1C)"
    interval_seconds = 86400
    category         = "continuous"

    TABLE_STAGING = "Import_1C.stg_Import_BOM"

    def run_once(self) -> int:
        conn_1c = conn_t = cur_1c = cur_t = None
        try:
            conn_1c = get_1c_connection()
            conn_t  = get_target_connection()
            cur_1c  = conn_1c.cursor()
            cur_t   = conn_t.cursor()
            cur_t.execute("SET XACT_ABORT ON; SET LOCK_TIMEOUT 60000;")

            cur_1c.execute(QUERY_BOM_TEMPLATE)
            columns_1c = [c[0] for c in cur_1c.description]
            rows_1c    = cur_1c.fetchall()

            if not rows_1c:
                return 0

            idx_start  = columns_1c.index('Start_Day')  if 'Start_Day'  in columns_1c else None
            idx_finish = columns_1c.index('Finish_Day') if 'Finish_Day' in columns_1c else None

            prepped = []
            for row in rows_1c:
                row = list(row)
                if idx_start  is not None and isinstance(row[idx_start],  dt_date):
                    row[idx_start]  = _shift_date_minus_2000(row[idx_start])
                if idx_finish is not None and isinstance(row[idx_finish], dt_date):
                    row[idx_finish] = _shift_date_minus_2000(row[idx_finish])
                prepped.append(tuple(row))
            rows_1c = prepped

            snapshot_id = str(uuid.uuid4())
            cur_t.execute(f"DELETE FROM {self.TABLE_STAGING} WHERE SnapshotID = ?", (snapshot_id,))

            insert_cols  = ['SnapshotID'] + columns_1c
            placeholders = ",".join(["?"] * len(insert_cols))
            insert_sql   = f"INSERT INTO {self.TABLE_STAGING} ({', '.join(insert_cols)}) VALUES ({placeholders})"
            payload = [(snapshot_id,) + tuple(row) for row in rows_1c]
            cur_t.fast_executemany = True
            cur_t.executemany(insert_sql, payload)
            conn_t.commit()

            self.acquire_applock(cur_t, "Migration_Import_BOM")
            cur_t.execute(
                "EXEC Import_1C.sp_SwitchSnapshot_Import_BOM @SnapshotID=?, @Full=1, @CleanupPrev=1",
                (snapshot_id,)
            )
            conn_t.commit()
            cur_t.execute("EXEC QC.sp_Refresh_QC_Repainting_Bom")
            conn_t.commit()

            cur_t.execute("SELECT COUNT(*) FROM Import_1C.vw_Import_BOM_Current")
            return cur_t.fetchone()[0]
        finally:
            for obj in (cur_1c, cur_t, conn_1c, conn_t):
                try:
                    if obj: obj.close()
                except Exception:
                    pass


if __name__ == "__main__":
    BomCopy().run()
