"""
Service layer for Production vs Defects dashboard.
Fetches aggregated data from QC.vw_Production_vs_Defects.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from ...database.db_connector import get_connection


def _fetch_query(conn, sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    cur = conn.cursor()
    cur.execute(sql, params)
    cols = [c[0] for c in cur.description]
    rows = []
    for row in cur.fetchall():
        record: Dict[str, Any] = {}
        for col, val in zip(cols, row):
            if hasattr(val, 'isoformat'):
                record[col] = val.isoformat()
            elif isinstance(val, bytes):
                record[col] = val.hex()
            else:
                record[col] = val
        rows.append(record)
    return rows


def fetch_production_vs_defects(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> List[Dict[str, Any]]:
    conditions = []
    params: list = []

    if date_from:
        conditions.append("OnlyDate >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("OnlyDate <= ?")
        params.append(date_to)

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    sql = f"""
        SELECT
            WorkShopID,
            WorkShopName_CH,
            WorkShop_Ru,
            SUM(Prod_QTY)            AS Prod_QTY,
            SUM(Prod_CostTotal)      AS Prod_CostTotal,
            SUM(Detection_QTY)       AS Detection_QTY,
            SUM(Detection_CostTotal) AS Detection_CostTotal
        FROM QC.vw_Production_vs_Defects
        {where_clause}
        GROUP BY WorkShopID, WorkShopName_CH, WorkShop_Ru
        ORDER BY WorkShop_Ru
    """

    with get_connection() as conn:
        return _fetch_query(conn, sql, tuple(params))
