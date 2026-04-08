"""QC Cards Full Sync — complete dump from 1C, runs weekly (Sunday 04:00)."""
import sys
import os
_MIG_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, _MIG_ROOT)
sys.path.insert(0, os.path.dirname(__file__))

import uuid
from datetime import date as dt_date
from core.base import BaseMigration
from core.db import get_1c_connection, get_target_connection
from sql import QUERY_QC_CARDS_WINDOW_TEMPLATE

TABLE_STAGING  = "Import_1C.stg_QC_Cards"
DATE_FIELDS    = ['Create_Date', 'Status_Date', 'Work_FinishDate']
START_4025     = "4025-01-01 00:00:00"


def _shift_minus_2000(v):
    shifted = v.replace(year=v.year - 2000)
    if hasattr(shifted, 'date'):
        return shifted.date()
    return shifted


class QCCardsFullSync(BaseMigration):
    script_id   = "1c_qc_cards_full"
    script_name = "QC Cards Full Sync (1C)"
    category    = "scheduled"

    def run_once(self) -> int:
        conn_1c = conn_t = cur_1c = cur_t = None
        try:
            conn_1c = get_1c_connection()
            conn_t  = get_target_connection()
            cur_1c  = conn_1c.cursor()
            cur_t   = conn_t.cursor()
            cur_t.execute("SET XACT_ABORT ON; SET LOCK_TIMEOUT 120000;")

            today    = dt_date.today()
            end_4025 = f"{today.year + 2000}-{today.month:02d}-{today.day:02d} 23:59:59"

            query = QUERY_QC_CARDS_WINDOW_TEMPLATE.format(
                date_from=START_4025, date_to=end_4025
            )
            cur_1c.execute(query)
            columns_1c = [c[0] for c in cur_1c.description]
            rows_1c    = cur_1c.fetchall()

            if not rows_1c:
                return 0

            date_indices = {f: columns_1c.index(f) for f in DATE_FIELDS if f in columns_1c}
            shifted = []
            for row in rows_1c:
                row = list(row)
                for idx in date_indices.values():
                    if row[idx] is not None:
                        row[idx] = _shift_minus_2000(row[idx])
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

            self.acquire_applock(cur_t, "Migration_QC_Cards")
            cur_t.execute(
                "EXEC Import_1C.sp_SwitchSnapshot_QC_Cards @SnapshotID=?, @Full=1, @CleanupPrev=1",
                (snapshot_id,)
            )
            conn_t.commit()

            cur_t.execute("EXEC QC.sp_Refresh_QC_Cards_Summary")
            conn_t.commit()

            return len(shifted)
        finally:
            for obj in (cur_1c, cur_t, conn_1c, conn_t):
                try:
                    if obj: obj.close()
                except Exception:
                    pass


if __name__ == "__main__":
    QCCardsFullSync().run_once_standalone()
