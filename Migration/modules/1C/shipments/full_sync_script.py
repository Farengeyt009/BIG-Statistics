"""Shipments Full Sync — full range 4025-01-01 → today+2000, runs weekly (Sunday 05:40)."""
import sys
import os
_MIG_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, _MIG_ROOT)
sys.path.insert(0, os.path.dirname(__file__))

import uuid
from datetime import date as dt_date, datetime as dt_datetime
from core.base import BaseMigration
from core.db import get_1c_connection, get_target_connection
from sql import QUERY_SHIPMENTS_TEMPLATE

TABLE_STAGING = "Import_1C.stg_Shipments"
START_4025    = "4025-01-01"


def _shift_minus_2000(v):
    if isinstance(v, dt_date) and not isinstance(v, dt_datetime):
        return v.replace(year=v.year - 2000)
    if isinstance(v, dt_datetime):
        return v.replace(year=v.year - 2000)
    return v


def _build_payload(cols, rows, snapshot_id):
    colset    = {c: i for i, c in enumerate(cols)}
    idx_SOD   = colset.get('SpendingOrder_Date')
    idx_ShipF = colset.get('ShipmentDate_Fact')
    idx_RealD = colset.get('RealizationDate')

    insert_cols = [
        'SpendingOrder_ID', 'SpendingOrder_No', 'Comment', 'RecipientID', 'TSD_ID',
        'SpendingOrder_Date_Real', 'NomenclatureID', 'OrderID_SpendingOrder_TableProduct',
        'SpendingOrder_QTY', 'ShipmentDate_Fact_Real', 'ContainerID_TSD', 'RealizationDocID',
        'RealizationDate_Real', 'RealizationDoc', 'PartnerID', 'ContainerID_Realization',
        'CI_NoID', 'CI_No', 'OrderNo_SpendingOrder_TableProduct', 'Article_number',
        'Name_CN', 'CBM', 'ContainerNO_Realization', 'Recipient_Name', 'Partner_Name',
        'UnitPrice', 'PriceTypeID', 'PriceTypeName', 'CNYRate', 'SnapshotID',
    ]

    payload = []
    for r in rows:
        r = list(r)
        payload.append(tuple([
            r[colset.get('SpendingOrder_ID')],
            r[colset.get('SpendingOrder_No')],
            r[colset.get('Comment')],
            r[colset.get('RecipientID')],
            r[colset.get('TSD_ID')],
            _shift_minus_2000(r[idx_SOD])   if idx_SOD   is not None else None,
            r[colset.get('NomenclatureID')],
            r[colset.get('OrderID_SpendingOrder_TableProduct')],
            r[colset.get('SpendingOrder_QTY')],
            _shift_minus_2000(r[idx_ShipF]) if idx_ShipF is not None else None,
            r[colset.get('ContainerID_TSD')],
            r[colset.get('RealizationDocID')],
            _shift_minus_2000(r[idx_RealD]) if idx_RealD is not None else None,
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
            snapshot_id,
        ]))
    return insert_cols, payload


class ShipmentsFullSync(BaseMigration):
    script_id   = "1c_shipments_full"
    script_name = "Shipments Full Sync (1C)"
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

            query = QUERY_SHIPMENTS_TEMPLATE.format(
                start_day=START_4025, finish_day=end_4025
            )
            cur_1c.execute(query)
            cols = [c[0] for c in cur_1c.description]
            rows = cur_1c.fetchall()

            if not rows:
                return 0

            snapshot_id = str(uuid.uuid4())
            insert_cols, payload = _build_payload(cols, rows, snapshot_id)

            placeholders = ','.join(['?'] * len(insert_cols))
            insert_sql   = f"INSERT INTO {TABLE_STAGING} ({', '.join(insert_cols)}) VALUES ({placeholders})"

            cur_t.execute(f"DELETE FROM {TABLE_STAGING} WHERE SnapshotID = ?", (snapshot_id,))
            cur_t.fast_executemany = True
            cur_t.executemany(insert_sql, payload)

            cur_t.execute(
                """
                ;WITH d AS (
                  SELECT *,
                         ROW_NUMBER() OVER (
                           PARTITION BY SpendingOrder_ID, NomenclatureID,
                                        OrderID_SpendingOrder_TableProduct
                           ORDER BY (SELECT 0)
                         ) rn
                  FROM Import_1C.stg_Shipments WHERE SnapshotID = ?
                )
                DELETE FROM d WHERE rn > 1;
                """,
                (snapshot_id,)
            )
            conn_t.commit()

            self.acquire_applock(cur_t, "Migration_Shipments")
            cur_t.execute(
                "EXEC Import_1C.sp_SwitchSnapshot_Shipments @SnapshotID=?, @Full=1, @CleanupPrev=1",
                (snapshot_id,)
            )
            conn_t.commit()

            return len(rows)
        finally:
            for obj in (cur_1c, cur_t, conn_1c, conn_t):
                try:
                    if obj: obj.close()
                except Exception:
                    pass


if __name__ == "__main__":
    ShipmentsFullSync().run_once_standalone()
