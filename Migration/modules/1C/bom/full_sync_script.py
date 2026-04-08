"""BOM Full Sync — complete dump from 1C, runs weekly (Sunday 03:00)."""
import sys
import os
_MIG_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, _MIG_ROOT)
sys.path.insert(0, os.path.dirname(__file__))

import uuid
from datetime import date as dt_date
from core.base import BaseMigration
from core.db import get_1c_connection, get_target_connection
from sql import QUERY_BOM_TEMPLATE

TABLE_STAGING = "Import_1C.stg_Import_BOM"


def _shift_minus_2000(v):
    if v is None:
        return None
    if isinstance(v, dt_date):
        return v.replace(year=v.year - 2000)
    return v


class BomFullSync(BaseMigration):
    script_id   = "1c_bom_full"
    script_name = "BOM Full Sync (1C)"
    category    = "scheduled"

    def run_once(self) -> int:
        conn_1c = conn_t = cur_1c = cur_t = None
        try:
            conn_1c = get_1c_connection()
            conn_t  = get_target_connection()
            cur_1c  = conn_1c.cursor()
            cur_t   = conn_t.cursor()
            cur_t.execute("SET XACT_ABORT ON; SET LOCK_TIMEOUT 120000;")

            cur_1c.execute(QUERY_BOM_TEMPLATE)
            columns_1c = [c[0] for c in cur_1c.description]
            rows_1c    = cur_1c.fetchall()

            if not rows_1c:
                return 0

            idx_start  = columns_1c.index('Start_Day')  if 'Start_Day'  in columns_1c else None
            idx_finish = columns_1c.index('Finish_Day') if 'Finish_Day' in columns_1c else None

            shifted = []
            for row in rows_1c:
                row = list(row)
                if idx_start  is not None: row[idx_start]  = _shift_minus_2000(row[idx_start])
                if idx_finish is not None: row[idx_finish] = _shift_minus_2000(row[idx_finish])
                shifted.append(tuple(row))

            snapshot_id  = str(uuid.uuid4())
            insert_cols  = ['SnapshotID'] + columns_1c
            placeholders = ','.join(['?'] * len(insert_cols))
            insert_sql   = f"INSERT INTO {TABLE_STAGING} ({', '.join(insert_cols)}) VALUES ({placeholders})"
            payload      = [(snapshot_id,) + r for r in shifted]

            cur_t.execute(f"DELETE FROM {TABLE_STAGING} WHERE SnapshotID = ?", (snapshot_id,))
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

            return len(shifted)
        finally:
            for obj in (cur_1c, cur_t, conn_1c, conn_t):
                try:
                    if obj: obj.close()
                except Exception:
                    pass


if __name__ == "__main__":
    BomFullSync().run_once_standalone()
