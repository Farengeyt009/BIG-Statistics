"""
Service layer for LQC Journal.
Fetches data from QC.LQC_Journal.
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


def fetch_lqc_journal(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> List[Dict[str, Any]]:
    conditions: list = []
    params: list = []

    if date_from:
        conditions.append("[Date] >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("[Date] <= ?")
        params.append(date_to)

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    sql = f"""
        SELECT
            [Date],
            Delete_Mark,
            Post_Mark,
            Doc_No,
            Avtor,
            Prod_Order_No,
            Customer_Order_No,
            Control_Tochka_Ru,
            Control_Tochka_Zh,
            Defect_Type_Ru,
            Defect_Type_Zh,
            Vinovnik_Dep_Ru,
            Vinovnik_Dep_Zh,
            Work_Nomenclature_No,
            Work_Nomenclature_NameRU,
            Work_Nomenclature_Namezh,
            LargeGroup,
            GroupName,
            Prod_Fact_QTY,
            Defect_QTY,
            Prod_QTY,
            Problem_Description,
            Problem_Description1
        FROM QC.LQC_Journal
        {where_clause}
        ORDER BY [Date] DESC
    """

    with get_connection() as conn:
        return _fetch_query(conn, sql, tuple(params))
