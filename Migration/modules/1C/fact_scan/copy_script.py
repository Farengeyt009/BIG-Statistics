"""Fact Scan Copy Script — 14-day window refresh every 60 seconds."""
import sys
import os
_MIG_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, _MIG_ROOT)
sys.path.insert(0, os.path.dirname(__file__))

import uuid
from datetime import datetime, timedelta, date as dt_date
from core.base import BaseMigration
from core.db import get_1c_connection, get_target_connection
from sql import QUERY_FACTSCAN_ONASSEMBLY_TEMPLATE

WINDOW_DAYS   = 14
TABLE_STAGING = "Import_1C.stg_FactScan_OnAssembly"
TABLE_TARGET  = "Import_1C.FactScan_OnAssembly"
POINTER_NAME  = "Import_1C.FactScan_OnAssembly"


def _normalize_date_like(val):
    if val is None:
        return None
    if isinstance(val, datetime):
        y = val.year
        if y >= 3000:
            return val.replace(year=y - 2000)
        if y < 1900:
            return val.replace(year=y + 2000)
        return val
    if isinstance(val, dt_date):
        y = val.year
        if y >= 3000:
            return val.replace(year=y - 2000)
        if y < 1900:
            return val.replace(year=y + 2000)
        return val
    return val


class FactScanCopy(BaseMigration):
    script_id        = "1c_fact_scan"
    script_name      = "Fact Scan Copy (1C)"
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
            date_from_real = today - timedelta(days=WINDOW_DAYS - 1)

            start_4025  = dt_date(date_from_real.year + 2000, date_from_real.month, date_from_real.day)
            finish_4025 = dt_date(date_to_real.year + 2000,   date_to_real.month,   date_to_real.day)

            query = QUERY_FACTSCAN_ONASSEMBLY_TEMPLATE.format(
                start_day=start_4025.strftime("%Y-%m-%d"),
                finish_day=finish_4025.strftime("%Y-%m-%d"),
            )

            cur_1c.execute(query)
            columns_1c = [c[0] for c in cur_1c.description]
            rows_1c    = cur_1c.fetchall()

            # Normalize ScanMinute dates
            idx_scan = columns_1c.index("ScanMinute") if "ScanMinute" in columns_1c else -1
            rows_1c = [
                tuple(
                    _normalize_date_like(v) if i == idx_scan else v
                    for i, v in enumerate(row)
                )
                for row in rows_1c
            ]

            # Ensure OnlyDate column
            if "OnlyDate" not in columns_1c and idx_scan >= 0:
                columns_1c = list(columns_1c) + ["OnlyDate"]
                rows_1c = [
                    tuple(list(r) + [r[idx_scan].date() if isinstance(r[idx_scan], datetime) else r[idx_scan]])
                    for r in rows_1c
                ]

            changed_dates = {r[-1] for r in rows_1c} if rows_1c else set()

            # SnapshotID
            cur_t.execute(
                "SELECT SnapshotID FROM Import_1C.SnapshotPointer WITH (READCOMMITTED) WHERE TableName = ?",
                (POINTER_NAME,),
            )
            row = cur_t.fetchone()
            snapshot_id = str(row[0]) if row and row[0] else str(uuid.uuid4())

            cur_t.execute(f"DELETE FROM {TABLE_STAGING} WHERE SnapshotID = ?", (snapshot_id,))

            if rows_1c:
                insert_cols  = ['SnapshotID'] + list(columns_1c)
                placeholders = ",".join(["?"] * len(insert_cols))
                insert_sql   = f"INSERT INTO {TABLE_STAGING} ({', '.join(insert_cols)}) VALUES ({placeholders})"
                payload = [(snapshot_id,) + tuple(r) for r in rows_1c]
                cur_t.fast_executemany = True
                cur_t.executemany(insert_sql, payload)
            conn_t.commit()

            cur_t.execute(f"SELECT TOP(1) 1 FROM {TABLE_STAGING} WHERE SnapshotID = ?", (snapshot_id,))
            if not cur_t.fetchone():
                return 0

            self.acquire_applock(cur_t, "Migration_FactScan_OnAssembly")
            cur_t.execute(
                f"DELETE FROM {TABLE_TARGET} WHERE SnapshotID = ? AND OnlyDate BETWEEN ? AND ?",
                (snapshot_id, date_from_real, date_to_real),
            )
            cur_t.execute(
                "EXEC Import_1C.sp_SwitchSnapshot_FactScan_OnAssembly"
                " @SnapshotID=?, @DateFrom=?, @DateTo=?, @Full=0, @CleanupPrev=1",
                (snapshot_id, date_from_real, date_to_real),
            )
            conn_t.commit()

            for d in sorted(changed_dates):
                cur_t.execute("EXEC Production_TV.sp_Refresh_Cache_Fact_Day  @date=?", (d,))
                cur_t.execute("EXEC Production_TV.sp_Refresh_Cache_Fact_Takt @date=?", (d,))
            conn_t.commit()

            return len(rows_1c)
        finally:
            for obj in (cur_1c, cur_t, conn_1c, conn_t):
                try:
                    if obj: obj.close()
                except Exception:
                    pass


if __name__ == "__main__":
    FactScanCopy().run()
