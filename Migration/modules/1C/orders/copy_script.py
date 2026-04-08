"""Copies Order_1C_v2 from 1C into the target DB (full refresh every cycle)."""
import sys
import os
import uuid
from datetime import datetime, date as dt_date, datetime as dt_datetime

_MIG_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, _MIG_ROOT)
sys.path.insert(0, os.path.dirname(__file__))

from core.base import BaseMigration
from core.db import get_1c_connection, get_target_connection
from sql import QUERY_ORDER_1C

TABLE_STAGING = "Import_1C.stg_Order_1C_v2"
SHIFT_YEARS   = 2000
ZERO_DATE     = dt_date(2001, 1, 1)

DATE_COLS = {
    "OrderDate", "OrderConformDay", "RunOrderDay",
    "OrderShipmentDay", "OrderShipmentDay_OR_T2", "PlannedShipmentDay",
    "CloseWork_StartDay", "CloseWork_FinishDay", "ScanStartDay", "ScanFinishDay",
    "ShipmentDate",
}


def _shift_and_normalize(value):
    if isinstance(value, dt_datetime):
        if value.date() == ZERO_DATE:
            return None
    if isinstance(value, dt_date) and not isinstance(value, dt_datetime):
        if value == ZERO_DATE:
            return None

    if isinstance(value, dt_datetime):
        return value.replace(year=value.year - SHIFT_YEARS) if value.year >= 4000 else value
    if isinstance(value, dt_date):
        return value.replace(year=value.year - SHIFT_YEARS) if value.year >= 4000 else value

    return value


class OrderCopy(BaseMigration):
    script_id        = "1c_order_1c_v2"
    script_name      = "1C Orders full refresh"
    interval_seconds = 120
    category         = "continuous"

    def run_once(self) -> int:
        conn_1c = conn_t = cur_1c = cur_t = None
        try:
            conn_1c = get_1c_connection()
            conn_t  = get_target_connection()
            cur_1c  = conn_1c.cursor()
            cur_t   = conn_t.cursor()
            cur_t.execute("SET XACT_ABORT ON; SET LOCK_TIMEOUT 60000;")

            cur_1c.execute(QUERY_ORDER_1C)
            cols = [c[0] for c in cur_1c.description]
            rows = cur_1c.fetchall()

            if not rows:
                return 0

            idx_to_shift = [i for i, name in enumerate(cols) if name in DATE_COLS]
            prepped = []
            for row in rows:
                r = list(row)
                for idx in idx_to_shift:
                    r[idx] = _shift_and_normalize(r[idx])
                prepped.append(tuple(r))
            rows = prepped

            snap = str(uuid.uuid4())

            cur_t.execute(f"DELETE FROM {TABLE_STAGING} WHERE SnapshotID = ?", (snap,))

            insert_cols  = ['SnapshotID'] + cols
            placeholders = ",".join(["?"] * len(insert_cols))
            insert_sql   = f"INSERT INTO {TABLE_STAGING} ({', '.join(insert_cols)}) VALUES ({placeholders})"

            payload = [(snap,) + tuple(r) for r in rows]
            cur_t.fast_executemany = True
            cur_t.executemany(insert_sql, payload)

            cur_t.execute(f"""
                ;WITH d AS (
                  SELECT *,
                         ROW_NUMBER() OVER (
                           PARTITION BY OrderID, NomenclatureID
                           ORDER BY (SELECT 0)
                         ) AS rn
                  FROM {TABLE_STAGING}
                  WHERE SnapshotID = ?
                )
                DELETE FROM d WHERE rn > 1;
            """, (snap,))
            conn_t.commit()

            cur_t.execute("""
                EXEC Import_1C.sp_SwitchSnapshot_Order_1C_v2
                  @SnapshotID = ?, @CleanupPrev = 1;
            """, (snap,))
            conn_t.commit()

            cur_t.execute(f"DELETE FROM {TABLE_STAGING} WHERE SnapshotID = ?", (snap,))
            conn_t.commit()

            return len(rows)
        finally:
            for obj in [cur_1c, cur_t, conn_1c, conn_t]:
                try:
                    if obj: obj.close()
                except Exception:
                    pass


if __name__ == "__main__":
    OrderCopy().run()
