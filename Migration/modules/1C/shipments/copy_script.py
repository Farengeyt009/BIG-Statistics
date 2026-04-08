"""Copies Shipments from 1C into the target DB (60-day rolling window)."""
import sys
import os
import uuid
from datetime import datetime, timedelta, date as dt_date, datetime as dt_datetime

_MIG_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, _MIG_ROOT)
sys.path.insert(0, os.path.dirname(__file__))

from core.base import BaseMigration
from core.db import get_1c_connection, get_target_connection
from sql import QUERY_SHIPMENTS_TEMPLATE

WINDOW_DAYS   = 60
TABLE_STAGING = "Import_1C.stg_Shipments"


def _shift_minus_2000(v):
    if isinstance(v, dt_date) and not isinstance(v, dt_datetime):
        return v.replace(year=v.year - 2000)
    if isinstance(v, dt_datetime):
        return v.replace(year=v.year - 2000)
    return v


def _ensure_pointer(cur_t):
    cur_t.execute("""
        SELECT SnapshotID
        FROM Import_1C.SnapshotPointer WITH (READCOMMITTED)
        WHERE TableName = 'Import_1C.Shipments'
    """)
    row = cur_t.fetchone()
    snap = str(row[0]) if row and row[0] is not None else None
    if snap:
        return snap

    cur_t.execute("SELECT TOP (1) SnapshotID FROM Import_1C.Shipments")
    row = cur_t.fetchone()
    if row and row[0] is not None:
        existing = str(row[0])
        cur_t.execute("""
            MERGE Import_1C.SnapshotPointer AS t
            USING (SELECT 'Import_1C.Shipments' AS TableName) s
            ON t.TableName = s.TableName
            WHEN MATCHED THEN UPDATE SET SnapshotID = ?
            WHEN NOT MATCHED THEN INSERT (TableName, SnapshotID) VALUES (s.TableName, ?);
        """, (existing, existing))
        return existing

    new_snap = str(uuid.uuid4())
    cur_t.execute("""
        MERGE Import_1C.SnapshotPointer AS t
        USING (SELECT 'Import_1C.Shipments' AS TableName) s
        ON t.TableName = s.TableName
        WHEN MATCHED THEN UPDATE SET SnapshotID = ?
        WHEN NOT MATCHED THEN INSERT (TableName, SnapshotID) VALUES (s.TableName, ?);
    """, (new_snap, new_snap))
    return new_snap


def _load_staging(cur_t, snapshot_id, cols, rows):
    colset   = {c: i for i, c in enumerate(cols)}
    idx_SOD  = colset.get('SpendingOrder_Date')
    idx_ShipF = colset.get('ShipmentDate_Fact')
    idx_RealD = colset.get('RealizationDate')

    insert_cols = [
        'SpendingOrder_ID', 'SpendingOrder_No', 'Comment', 'RecipientID', 'TSD_ID',
        'SpendingOrder_Date_Real', 'NomenclatureID', 'OrderID_SpendingOrder_TableProduct',
        'SpendingOrder_QTY', 'ShipmentDate_Fact_Real', 'ContainerID_TSD', 'RealizationDocID',
        'RealizationDate_Real', 'RealizationDoc', 'PartnerID', 'ContainerID_Realization',
        'CI_NoID', 'CI_No', 'OrderNo_SpendingOrder_TableProduct', 'Article_number', 'Name_CN', 'CBM',
        'ContainerNO_Realization', 'Recipient_Name', 'Partner_Name',
        'UnitPrice', 'PriceTypeID', 'PriceTypeName', 'CNYRate',
        'SnapshotID'
    ]
    placeholders = ",".join(["?"] * len(insert_cols))
    sql = f"INSERT INTO {TABLE_STAGING} ({', '.join(insert_cols)}) VALUES ({placeholders})"

    payload = []
    for r in rows:
        r = list(r)
        sod_real   = _shift_minus_2000(r[idx_SOD])   if idx_SOD   is not None else None
        shipf_real = _shift_minus_2000(r[idx_ShipF]) if idx_ShipF is not None else None
        reald_real = _shift_minus_2000(r[idx_RealD]) if idx_RealD is not None else None

        row_out = [
            r[colset.get('SpendingOrder_ID')],
            r[colset.get('SpendingOrder_No')],
            r[colset.get('Comment')],
            r[colset.get('RecipientID')],
            r[colset.get('TSD_ID')],
            sod_real,
            r[colset.get('NomenclatureID')],
            r[colset.get('OrderID_SpendingOrder_TableProduct')],
            r[colset.get('SpendingOrder_QTY')],
            shipf_real,
            r[colset.get('ContainerID_TSD')],
            r[colset.get('RealizationDocID')],
            reald_real,
            r[colset.get('RealizationDoc')],
            r[colset.get('PartnerID')],
            r[colset.get('ContainerID_Realization')],
            r[colset.get('CI_NoID')],
            r[colset.get('CI_No')],
            r[colset.get('OrderNo_SpendingOrder_TableProduct')],
            r[colset.get('Article_number')],
            r[colset.get('Name_CN')],
            r[colset.get('CBM')],
            r[colset.get('ContainerNO_Realization')],
            r[colset.get('Recipient_Name')],
            r[colset.get('Partner_Name')],
            r[colset.get('UnitPrice')],
            r[colset.get('PriceTypeID')],
            r[colset.get('PriceTypeName')],
            r[colset.get('CNYRate')],
            snapshot_id
        ]
        payload.append(tuple(row_out))

    if payload:
        cur_t.fast_executemany = True
        cur_t.executemany(sql, payload)


def _dedupe_staging(cur_t, snapshot_id):
    cur_t.execute(
        """
        ;WITH d AS (
          SELECT *,
                 ROW_NUMBER() OVER (
                   PARTITION BY SpendingOrder_ID, NomenclatureID, OrderID_SpendingOrder_TableProduct
                   ORDER BY (SELECT 0)
                 ) rn
          FROM Import_1C.stg_Shipments
          WHERE SnapshotID = ?
        )
        DELETE FROM d WHERE rn > 1;
        """,
        (snapshot_id,)
    )


class ShipmentsCopy(BaseMigration):
    script_id        = "1c_shipments"
    script_name      = "1C Shipments (60-day window)"
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

            start_4025  = dt_date(year=date_from_real.year + 2000, month=date_from_real.month, day=date_from_real.day)
            finish_4025 = dt_date(year=date_to_real.year   + 2000, month=date_to_real.month,   day=date_to_real.day)

            query = QUERY_SHIPMENTS_TEMPLATE.format(
                start_day=start_4025.strftime("%Y-%m-%d"),
                finish_day=finish_4025.strftime("%Y-%m-%d")
            )

            cur_1c.execute(query)
            cols = [c[0] for c in cur_1c.description]
            rows = cur_1c.fetchall()

            if not rows:
                return 0

            snapshot_id = _ensure_pointer(cur_t)

            cur_t.execute(f"DELETE FROM {TABLE_STAGING} WHERE SnapshotID = ?", (snapshot_id,))
            _load_staging(cur_t, snapshot_id, cols, rows)
            _dedupe_staging(cur_t, snapshot_id)
            conn_t.commit()

            cur_t.execute(f"SELECT TOP (1) 1 FROM {TABLE_STAGING} WHERE SnapshotID = ?", (snapshot_id,))
            if cur_t.fetchone() is None:
                return 0

            self.acquire_applock(cur_t, "Migration_Shipments")
            cur_t.execute(
                """
                DELETE FROM Import_1C.Shipments
                WHERE SnapshotID = ?
                  AND CONVERT(date, SpendingOrder_Date_Real) BETWEEN ? AND ?;
                """,
                (snapshot_id, date_from_real, date_to_real)
            )

            cur_t.execute(
                """
                EXEC Import_1C.sp_SwitchSnapshot_Shipments
                  @SnapshotID = ?, @DateFrom = ?, @DateTo = ?, @Full = 0, @CleanupPrev = 1;
                """,
                (snapshot_id, date_from_real, date_to_real)
            )
            conn_t.commit()

            return len(rows)
        finally:
            for obj in [cur_1c, cur_t, conn_1c, conn_t]:
                try:
                    if obj: obj.close()
                except Exception:
                    pass


if __name__ == "__main__":
    ShipmentsCopy().run()
