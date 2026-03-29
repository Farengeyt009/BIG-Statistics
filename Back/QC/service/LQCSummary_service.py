"""
Service layer for LQC Summary dashboard card.

Returns aggregated LQC data for a date range:
  - total_prod_qty   : deduplicated production qty
                       (per Date + Control_Tochka_Ru + Prod_Order_No key,
                        avg if values differ, then sum)
  - total_defect_qty : total defect quantity
  - defect_types     : list of {Defect_Type_Ru, Defect_Type_Zh, Defect_QTY}
                        sorted by Defect_QTY desc
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from ...database.db_connector import get_connection


def fetch_lqc_summary(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> Dict[str, Any]:
    conditions: list = []
    params: list = []

    if date_from:
        conditions.append("[Date] >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("[Date] <= ?")
        params.append(date_to)

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    # ── Итоговый выпуск (дедупликация по Date + КТ + Заказ) ────────────────
    sql_prod = f"""
        SELECT SUM(Avg_PF) AS Total_Prod_QTY
        FROM (
            SELECT AVG(Prod_Fact_QTY) AS Avg_PF
            FROM QC.LQC_Journal
            {where_clause}
            GROUP BY [Date], Control_Tochka_Ru, Prod_Order_No
        ) AS deduped
    """

    # ── Итого брак ──────────────────────────────────────────────────────────
    sql_defect = f"""
        SELECT SUM(Defect_QTY) AS Total_Defect_QTY
        FROM QC.LQC_Journal
        {where_clause}
    """

    # ── Брак по типу дефекта ────────────────────────────────────────────────
    sql_types = f"""
        SELECT
            ISNULL(Defect_Type_Ru, N'—') AS Defect_Type_Ru,
            ISNULL(Defect_Type_Zh, N'—') AS Defect_Type_Zh,
            SUM(Defect_QTY)              AS Defect_QTY
        FROM QC.LQC_Journal
        {where_clause}
        GROUP BY Defect_Type_Ru, Defect_Type_Zh
        ORDER BY SUM(Defect_QTY) DESC
    """

    with get_connection() as conn:
        cur = conn.cursor()

        cur.execute(sql_prod, tuple(params))
        row = cur.fetchone()
        total_prod_qty = float(row[0]) if row and row[0] is not None else 0.0

        cur.execute(sql_defect, tuple(params))
        row = cur.fetchone()
        total_defect_qty = float(row[0]) if row and row[0] is not None else 0.0

        cur.execute(sql_types, tuple(params))
        cols = [c[0] for c in cur.description]
        defect_types = []
        for r in cur.fetchall():
            record: Dict[str, Any] = {}
            for col, val in zip(cols, r):
                record[col] = float(val) if hasattr(val, '__float__') and not isinstance(val, str) else val
            defect_types.append(record)

    return {
        "total_prod_qty":   total_prod_qty,
        "total_defect_qty": total_defect_qty,
        "defect_types":     defect_types,
    }
