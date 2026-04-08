"""Plan-Fact Full Sync — full range 4025-01-01 → today+2000, runs weekly (Sunday 05:00)."""
import sys
import os
_MIG_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, _MIG_ROOT)
sys.path.insert(0, os.path.dirname(__file__))

import uuid
from datetime import date as dt_date
from core.base import BaseMigration
from core.db import get_1c_connection, get_target_connection
from sql import QUERY_DAILY_PLANFACT_TEMPLATE

TABLE_STAGING = "Import_1C.stg_Daily_PlanFact"
START_4025    = "4025-01-01"


class PlanFactFullSync(BaseMigration):
    script_id   = "1c_plan_fact_full"
    script_name = "Plan-Fact Full Sync (1C)"
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
            end_4025 = f"{today.year + 2000}-{today.month:02d}-{today.day:02d}"

            query = QUERY_DAILY_PLANFACT_TEMPLATE.format(
                start_day=START_4025, finish_day=end_4025
            )
            cur_1c.execute(query)
            columns_1c = [c[0] for c in cur_1c.description]
            rows_1c    = cur_1c.fetchall()

            if not rows_1c:
                return 0

            changed_dates = set()
            idx_date = columns_1c.index('OnlyDate') if 'OnlyDate' in columns_1c else None
            shifted = []
            for row in rows_1c:
                row = list(row)
                if idx_date is not None and isinstance(row[idx_date], dt_date):
                    row[idx_date] = row[idx_date].replace(year=row[idx_date].year - 2000)
                    changed_dates.add(row[idx_date])
                shifted.append(tuple(row))

            snapshot_id = str(uuid.uuid4())

            # Deduplicate in staging
            insert_cols  = ['SnapshotID'] + columns_1c
            placeholders = ','.join(['?'] * len(insert_cols))
            insert_sql   = f"INSERT INTO {TABLE_STAGING} ({', '.join(insert_cols)}) VALUES ({placeholders})"
            payload      = [(snapshot_id,) + r for r in shifted]

            cur_t.execute(f"DELETE FROM {TABLE_STAGING} WHERE SnapshotID = ?", (snapshot_id,))
            cur_t.fast_executemany = True
            cur_t.executemany(insert_sql, payload)

            cur_t.execute(
                f"""
                ;WITH d AS (
                  SELECT *,
                         ROW_NUMBER() OVER (
                           PARTITION BY OnlyDate, WorkCentorID, WorkNumberID,
                                        ProductionOrderID, NomenclatureID
                           ORDER BY (SELECT 0)
                         ) AS rn
                  FROM {TABLE_STAGING} WHERE SnapshotID = ?
                )
                DELETE FROM d WHERE rn > 1;
                """,
                (snapshot_id,)
            )
            conn_t.commit()

            self.acquire_applock(cur_t, "Migration_Daily_PlanFact")
            cur_t.execute(
                "EXEC Import_1C.sp_SwitchSnapshot_Daily_PlanFact @SnapshotID=?, @Full=1, @CleanupPrev=1",
                (snapshot_id,)
            )
            conn_t.commit()

            if changed_dates:
                for d in sorted(changed_dates):
                    cur_t.execute("EXEC Production_TV.sp_Refresh_Cache_Plan_Base @date=?", (d,))
                    cur_t.execute("EXEC Production_TV.sp_Refresh_Cache_OrderSlots_Day @date=?", (d,))
                conn_t.commit()

            cur_t.execute("EXEC QC.sp_Refresh_Production_Output_Cost")
            conn_t.commit()

            return len(shifted)
        finally:
            for obj in (cur_1c, cur_t, conn_1c, conn_t):
                try:
                    if obj: obj.close()
                except Exception:
                    pass


if __name__ == "__main__":
    PlanFactFullSync().run_once_standalone()
