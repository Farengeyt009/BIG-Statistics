"""
Service layer for Defects Movement.
Fetches data from QC.Defects_Movement.
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


def fetch_defects_movement(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> List[Dict[str, Any]]:
    conditions = []
    params: list = []

    if date_from:
        conditions.append("Doc_Date >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("Doc_Date <= ?")
        params.append(date_to)

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    sql = f"""
        SELECT
            Delete_Mark,
            Posted,
            Doc_Date,
            Doc_No,
            Nomencl_Type_RU,
            Nomencl_Type_ZH,
            Nomencl_No,
            Nomencl_Name_RU,
            Nomencl_Name_ZH,
            QTY,
            Total_Cost,
            Doc_Comment,
            Goods_Doc_Comment,
            Guilty_Dep_RU,
            Guilty_Dep_ZH,
            Avtor_Name,
            Responsible_Name,
            Sender_WH_Ru,
            Sender_WH_Zh,
            Recipient_WH_Ru,
            Recipient_WH_Zh,
            Price
        FROM QC.Defects_Movement
        {where_clause}
        ORDER BY Doc_Date DESC
    """

    with get_connection() as conn:
        return _fetch_query(conn, sql, tuple(params))


def fetch_defects_movement_summary(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> Dict[str, Any]:
    conditions = ["Delete_Mark = ?"]
    params: list = [b'\x00']

    if date_from:
        conditions.append("Doc_Date >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("Doc_Date <= ?")
        params.append(date_to)

    where_clause = "WHERE " + " AND ".join(conditions)

    sql = f"""
        SELECT
            SUM(QTY)        AS QTY,
            SUM(Total_Cost) AS Total_Cost
        FROM QC.Defects_Movement
        {where_clause}
    """

    with get_connection() as conn:
        rows = _fetch_query(conn, sql, tuple(params))
        return rows[0] if rows else {"QTY": None, "Total_Cost": None}
