"""Copies Daily_PlanFact from 1C into the target DB (60-day rolling window)."""
import sys
import os
import uuid
from datetime import datetime, timedelta, date as dt_date

_MIG_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, _MIG_ROOT)
sys.path.insert(0, os.path.dirname(__file__))

from core.base import BaseMigration
from core.db import get_1c_connection, get_target_connection
from sql import QUERY_DAILY_PLANFACT_TEMPLATE

WINDOW_DAYS   = 60
TABLE_STAGING = "Import_1C.stg_Daily_PlanFact"


def _shift_onlydate_minus_2000(y):
    return y.replace(year=y.year - 2000)


def _ensure_snapshot_id(cur_t):
    cur_t.execute("""
        SELECT SnapshotID
        FROM Import_1C.SnapshotPointer WITH (READCOMMITTED)
        WHERE TableName = 'Import_1C.Daily_PlanFact'
    """)
    row = cur_t.fetchone()
    snap = str(row[0]) if row and row[0] is not None else None
    if snap:
        return snap

    cur_t.execute("SELECT TOP (1) SnapshotID FROM Import_1C.Daily_PlanFact")
    row = cur_t.fetchone()
    if row and row[0] is not None:
        existing = str(row[0])
        cur_t.execute("""
            MERGE Import_1C.SnapshotPointer AS t
            USING (SELECT 'Import_1C.Daily_PlanFact' AS TableName) s
            ON t.TableName = s.TableName
            WHEN MATCHED THEN UPDATE SET SnapshotID = ?
            WHEN NOT MATCHED THEN INSERT (TableName, SnapshotID) VALUES (s.TableName, ?);
        """, (existing, existing))
        return existing

    new_snap = str(uuid.uuid4())
    cur_t.execute("""
        MERGE Import_1C.SnapshotPointer AS t
        USING (SELECT 'Import_1C.Daily_PlanFact' AS TableName) s
        ON t.TableName = s.TableName
        WHEN MATCHED THEN UPDATE SET SnapshotID = ?
        WHEN NOT MATCHED THEN INSERT (TableName, SnapshotID) VALUES (s.TableName, ?);
    """, (new_snap, new_snap))
    return new_snap


def _dedupe_staging(cur_t, snapshot_id):
    cur_t.execute(
        """
        ;WITH d AS (
          SELECT *,
                 ROW_NUMBER() OVER (
                   PARTITION BY OnlyDate, WorkCentorID, WorkNumberID, ProductionOrderID, NomenclatureID
                   ORDER BY (SELECT 0)
                 ) AS rn
          FROM Import_1C.stg_Daily_PlanFact
          WHERE SnapshotID = ?
        )
        DELETE FROM d WHERE rn > 1;
        """,
        (snapshot_id,)
    )


class PlanFactCopy(BaseMigration):
    script_id        = "1c_daily_planfact"
    script_name      = "1C Daily PlanFact (60-day window)"
    interval_seconds = 60
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

            finish_4025 = dt_date(year=date_to_real.year   + 2000, month=date_to_real.month,   day=date_to_real.day)
            start_4025  = dt_date(year=date_from_real.year + 2000, month=date_from_real.month, day=date_from_real.day)

            query = QUERY_DAILY_PLANFACT_TEMPLATE.format(
                start_day=start_4025.strftime("%Y-%m-%d"),
                finish_day=finish_4025.strftime("%Y-%m-%d")
            )

            cur_1c.execute(query)
            columns_1c = [c[0] for c in cur_1c.description]
            rows_1c = cur_1c.fetchall()

            if not rows_1c:
                return 0

            changed_dates = set()
            if 'OnlyDate' in columns_1c:
                idx_onlydate = columns_1c.index('OnlyDate')
                prepped = []
                for row in rows_1c:
                    row = list(row)
                    if isinstance(row[idx_onlydate], dt_date):
                        row[idx_onlydate] = _shift_onlydate_minus_2000(row[idx_onlydate])
                        changed_dates.add(row[idx_onlydate])
                    prepped.append(tuple(row))
                rows_1c = prepped
            else:
                d = date_from_real
                while d <= date_to_real:
                    changed_dates.add(d)
                    d += timedelta(days=1)

            snapshot_id = _ensure_snapshot_id(cur_t)

            cur_t.execute(f"DELETE FROM {TABLE_STAGING} WHERE SnapshotID = ?", (snapshot_id,))

            insert_cols  = ['SnapshotID'] + columns_1c
            placeholders = ",".join(["?"] * len(insert_cols))
            insert_sql   = f"INSERT INTO {TABLE_STAGING} ({', '.join(insert_cols)}) VALUES ({placeholders})"
            payload      = [(snapshot_id,) + tuple(r) for r in rows_1c]
            cur_t.fast_executemany = True
            cur_t.executemany(insert_sql, payload)

            _dedupe_staging(cur_t, snapshot_id)
            conn_t.commit()

            cur_t.execute(f"SELECT TOP (1) 1 FROM {TABLE_STAGING} WHERE SnapshotID = ?", (snapshot_id,))
            if cur_t.fetchone() is None:
                return 0

            self.acquire_applock(cur_t, "Migration_Daily_PlanFact")
            cur_t.execute(
                """
                DELETE FROM Import_1C.Daily_PlanFact
                WHERE SnapshotID = ?
                  AND OnlyDate BETWEEN ? AND ?;
                """,
                (snapshot_id, date_from_real, date_to_real)
            )

            cur_t.execute(
                """
                EXEC Import_1C.sp_SwitchSnapshot_Daily_PlanFact
                  @SnapshotID = ?, @DateFrom = ?, @DateTo = ?, @Full = 0, @CleanupPrev = 1;
                """,
                (snapshot_id, date_from_real, date_to_real)
            )

            if changed_dates:
                for d in sorted(changed_dates):
                    cur_t.execute("EXEC Production_TV.sp_Refresh_Cache_Plan_Base @date = ?", (d,))
                    cur_t.execute("EXEC Production_TV.sp_Refresh_Cache_OrderSlots_Day @date = ?", (d,))
            conn_t.commit()

            cur_t.execute("EXEC QC.sp_Refresh_Production_Output_Cost")
            conn_t.commit()

            cur_t.execute("SELECT COUNT(*) FROM QC.Production_Output_Cost")
            output_count = cur_t.fetchone()[0]

            return output_count
        finally:
            for obj in [cur_1c, cur_t, conn_1c, conn_t]:
                try:
                    if obj: obj.close()
                except Exception:
                    pass


if __name__ == "__main__":
    PlanFactCopy().run()
