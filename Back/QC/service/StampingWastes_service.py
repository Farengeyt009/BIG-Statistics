"""
Service layer for Stamping Weight Summary.
Fetches data from QC.Stamping_Weight_Summary.
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


def fetch_stamping_wastes(
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
            Date,
            NomenclatureNumber,
            ProductName_CN,
            FACT_QTY,
            Weight_FACT,
            Cost_FACT,
            Debugging_QTY,
            Weight_Debugging,
            Cost_Debugging,
            QCCard_Others_QTY,
            Weight_Others,
            Cost_Others,
            GP_Weight,
            Price
        FROM QC.Stamping_Weight_Summary
        {where_clause}
        ORDER BY [Date] DESC, NomenclatureNumber
    """

    with get_connection() as conn:
        return _fetch_query(conn, sql, tuple(params))
