"""Copies QC_Cards from 1C into the target DB (60-day rolling window)."""
import sys
import os
import uuid
from datetime import datetime, timedelta, date as dt_date

_MIG_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, _MIG_ROOT)
sys.path.insert(0, os.path.dirname(__file__))

from core.base import BaseMigration
from core.db import get_1c_connection, get_target_connection
from sql import QUERY_QC_CARDS_WINDOW_TEMPLATE

WINDOW_DAYS   = 60
TABLE_STAGING = "Import_1C.stg_QC_Cards"


def _shift_date_minus_2000(y):
    shifted = y.replace(year=y.year - 2000)
    if hasattr(shifted, 'date'):
        return shifted.date()
    return shifted


def _ensure_snapshot_id(cur_t):
    cur_t.execute("""
        SELECT SnapshotID
        FROM Import_1C.SnapshotPointer WITH (READCOMMITTED)
        WHERE TableName = 'Import_1C.QC_Cards'
    """)
    row = cur_t.fetchone()
    snap = str(row[0]) if row and row[0] is not None else None
    if snap:
        return snap

    cur_t.execute("SELECT TOP (1) SnapshotID FROM Import_1C.QC_Cards")
    row = cur_t.fetchone()
    if row and row[0] is not None:
        existing = str(row[0])
        cur_t.execute("""
            MERGE Import_1C.SnapshotPointer AS t
            USING (SELECT 'Import_1C.QC_Cards' AS TableName) s
            ON t.TableName = s.TableName
            WHEN MATCHED THEN UPDATE SET SnapshotID = ?
            WHEN NOT MATCHED THEN INSERT (TableName, SnapshotID) VALUES (s.TableName, ?);
        """, (existing, existing))
        return existing

    new_snap = str(uuid.uuid4())
    cur_t.execute("""
        MERGE Import_1C.SnapshotPointer AS t
        USING (SELECT 'Import_1C.QC_Cards' AS TableName) s
        ON t.TableName = s.TableName
        WHEN MATCHED THEN UPDATE SET SnapshotID = ?
        WHEN NOT MATCHED THEN INSERT (TableName, SnapshotID) VALUES (s.TableName, ?);
    """, (new_snap, new_snap))
    return new_snap


class QCCardsCopy(BaseMigration):
    script_id        = "1c_qc_cards"
    script_name      = "1C QC Cards (60-day window)"
    interval_seconds = 600
    category         = "continuous"

    def run_once(self) -> int:
        conn_1c = conn_t = cur_1c = cur_t = None
        try:
            conn_1c = get_1c_connection()
            conn_t  = get_target_connection()
            cur_1c  = conn_1c.cursor()
            cur_t   = conn_t.cursor()

            cur_t.execute("SET XACT_ABORT ON; SET LOCK_TIMEOUT 60000;")

            today          = datetime.today().date()
            date_to_real   = today
            date_from_real = today - timedelta(days=WINDOW_DAYS)

            datetime_to_4025   = datetime(year=date_to_real.year   + 2000, month=date_to_real.month,   day=date_to_real.day,   hour=23, minute=59, second=59)
            datetime_from_4025 = datetime(year=date_from_real.year + 2000, month=date_from_real.month, day=date_from_real.day, hour=0,  minute=0,  second=0)

            query = QUERY_QC_CARDS_WINDOW_TEMPLATE.format(
                date_from=datetime_from_4025.strftime("%Y-%m-%d %H:%M:%S"),
                date_to=datetime_to_4025.strftime("%Y-%m-%d %H:%M:%S")
            )

            cur_1c.execute(query)
            columns_1c = [c[0] for c in cur_1c.description]
            rows_1c = cur_1c.fetchall()

            if not rows_1c:
                return 0

            date_fields  = ['Create_Date', 'Status_Date', 'Work_FinishDate']
            date_indices = {f: columns_1c.index(f) for f in date_fields if f in columns_1c}

            if date_indices:
                prepped = []
                for row in rows_1c:
                    row = list(row)
                    for field, idx in date_indices.items():
                        if row[idx] is not None:
                            row[idx] = _shift_date_minus_2000(row[idx])
                    prepped.append(tuple(row))
                rows_1c = prepped

            snapshot_id = _ensure_snapshot_id(cur_t)

            cur_t.execute(f"DELETE FROM {TABLE_STAGING} WHERE SnapshotID = ?", (snapshot_id,))

            insert_cols  = ['SnapshotID'] + columns_1c
            placeholders = ",".join(["?"] * len(insert_cols))
            insert_sql   = f"INSERT INTO {TABLE_STAGING} ({', '.join(insert_cols)}) VALUES ({placeholders})"

            payload = [(snapshot_id,) + tuple(row) for row in rows_1c]
            cur_t.fast_executemany = True
            cur_t.executemany(insert_sql, payload)
            conn_t.commit()

            cur_t.execute(f"SELECT TOP (1) 1 FROM {TABLE_STAGING} WHERE SnapshotID = ?", (snapshot_id,))
            if cur_t.fetchone() is None:
                return 0

            self.acquire_applock(cur_t, "Migration_QC_Cards")
            cur_t.execute(
                """
                DELETE FROM Import_1C.QC_Cards
                WHERE SnapshotID = ?
                  AND Create_Date BETWEEN ? AND ?;
                """,
                (snapshot_id, date_from_real, date_to_real)
            )

            cur_t.execute(
                """
                EXEC Import_1C.sp_SwitchSnapshot_QC_Cards
                  @SnapshotID  = ?,
                  @DateFrom    = ?,
                  @DateTo      = ?,
                  @Full        = 0,
                  @CleanupPrev = 1;
                """,
                (snapshot_id, date_from_real, date_to_real)
            )
            conn_t.commit()

            cur_t.execute("EXEC QC.sp_Refresh_QC_Cards_Summary")
            conn_t.commit()

            cur_t.execute("SELECT COUNT(*) FROM Import_1C.vw_QC_Cards_Current")
            final_count = cur_t.fetchone()[0]

            return final_count
        finally:
            for obj in [cur_1c, cur_t, conn_1c, conn_t]:
                try:
                    if obj: obj.close()
                except Exception:
                    pass


if __name__ == "__main__":
    QCCardsCopy().run()
