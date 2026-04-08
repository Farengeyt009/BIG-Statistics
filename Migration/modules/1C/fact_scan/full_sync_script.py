"""Fact Scan Full Sync — full range 4025-01-01 → today+2000, runs weekly (Sunday 05:20)."""
import sys
import os
_MIG_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, _MIG_ROOT)
sys.path.insert(0, os.path.dirname(__file__))

import uuid
from datetime import datetime, date as dt_date
from core.base import BaseMigration
from core.db import get_1c_connection, get_target_connection
from sql import QUERY_FACTSCAN_ONASSEMBLY_TEMPLATE

TABLE_STAGING = "Import_1C.stg_FactScan_OnAssembly"
TABLE_TARGET  = "Import_1C.FactScan_OnAssembly"
POINTER_NAME  = "Import_1C.FactScan_OnAssembly"
START_4025    = "4025-01-01"


def _normalize_date_like(val):
    if val is None:
        return None
    if isinstance(val, datetime):
        y = val.year
        if y >= 3000: return val.replace(year=y - 2000)
        if y < 1900:  return val.replace(year=y + 2000)
        return val
    if isinstance(val, dt_date):
        y = val.year
        if y >= 3000: return val.replace(year=y - 2000)
        if y < 1900:  return val.replace(year=y + 2000)
        return val
    return val


class FactScanFullSync(BaseMigration):
    script_id   = "1c_fact_scan_full"
    script_name = "Fact Scan Full Sync (1C)"
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

            query = QUERY_FACTSCAN_ONASSEMBLY_TEMPLATE.format(
                start_day=START_4025, finish_day=end_4025
            )
            cur_1c.execute(query)
            columns_1c = list(c[0] for c in cur_1c.description)
            rows_1c    = cur_1c.fetchall()

            if not rows_1c:
                return 0

            idx_scan = columns_1c.index("ScanMinute") if "ScanMinute" in columns_1c else -1
            rows_1c = [
                tuple(_normalize_date_like(v) if i == idx_scan else v for i, v in enumerate(row))
                for row in rows_1c
            ]

            if "OnlyDate" not in columns_1c and idx_scan >= 0:
                columns_1c.append("OnlyDate")
                rows_1c = [
                    tuple(list(r) + [r[idx_scan].date() if isinstance(r[idx_scan], datetime) else r[idx_scan]])
                    for r in rows_1c
                ]

            changed_dates = {r[-1] for r in rows_1c}

            # Get or create SnapshotID
            cur_t.execute(
                "SELECT SnapshotID FROM Import_1C.SnapshotPointer WITH (READCOMMITTED) WHERE TableName = ?",
                (POINTER_NAME,),
            )
            row = cur_t.fetchone()
            snapshot_id = str(row[0]) if row and row[0] else str(uuid.uuid4())

            cur_t.execute(f"DELETE FROM {TABLE_STAGING} WHERE SnapshotID = ?", (snapshot_id,))

            insert_cols  = ['SnapshotID'] + columns_1c
            placeholders = ','.join(['?'] * len(insert_cols))
            insert_sql   = f"INSERT INTO {TABLE_STAGING} ({', '.join(insert_cols)}) VALUES ({placeholders})"
            payload      = [(snapshot_id,) + tuple(r) for r in rows_1c]
            cur_t.fast_executemany = True
            cur_t.executemany(insert_sql, payload)

            # Deduplicate staging
            cur_t.execute(
                f"""
                ;WITH d AS (
                  SELECT *,
                         ROW_NUMBER() OVER (
                           PARTITION BY ScanMinute, WorkCenterID, WorkNumberID,
                                        ProductionOrderID, NomenclatureNumberID
                           ORDER BY COALESCE(ScanMinute, CAST(OnlyDate AS datetime2(0))) ASC
                         ) AS rn
                  FROM {TABLE_STAGING} WHERE SnapshotID = ?
                )
                DELETE FROM d WHERE rn > 1;
                """,
                (snapshot_id,)
            )
            conn_t.commit()

            # Full switch: clear all existing data and reload
            self.acquire_applock(cur_t, "Migration_FactScan_OnAssembly")
            cur_t.execute(f"DELETE FROM {TABLE_TARGET} WHERE SnapshotID = ?", (snapshot_id,))

            real_start = dt_date(2025, 1, 1)
            real_end   = today
            cur_t.execute(
                "EXEC Import_1C.sp_SwitchSnapshot_FactScan_OnAssembly"
                " @SnapshotID=?, @DateFrom=?, @DateTo=?, @Full=1, @CleanupPrev=1",
                (snapshot_id, real_start, real_end),
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
    FactScanFullSync().run_once_standalone()
