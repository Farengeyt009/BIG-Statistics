"""
Service layer for Defect Cards.
Fetches data from QC.QC_Cards_Summary.
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


def fetch_defect_cards(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> List[Dict[str, Any]]:
    conditions = []
    params: list = []

    if date_from:
        conditions.append("Create_Date >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("Create_Date <= ?")
        params.append(date_to)

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    sql = f"""
        SELECT
            Delete_Mark,
            Posted_Mark,
            Create_Date,
            Status_Date,
            QC_Card_StatusRu,
            QC_Card_StatusZh,
            QC_Card_No,
            ProdOrder_No,
            Customer_Order_No,
            QC_Card_Nomenclature_No,
            QC_Card_Nomenclature_NameRU,
            QC_Card_Nomenclature_Namezh,
            QCcardConclusion_No,
            QCCard_QTY,
            Defect_TypeRu,
            Defect_TypeZh,
            Cause_of_Defect,
            Comment,
            VinovnikDep_Ru,
            VinovnikDep_Zh,
            Avtor_Name,
            Material_Cost,
            Labor_Hours,
            Labor_Cost
        FROM QC.QC_Cards_Summary
        {where_clause}
        ORDER BY Create_Date DESC
    """

    with get_connection() as conn:
        return _fetch_query(conn, sql, tuple(params))


def fetch_defect_cards_summary(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> Dict[str, Any]:
    conditions = ["Delete_Mark = ?"]
    params: list = [b'\x00']

    if date_from:
        conditions.append("Create_Date >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("Create_Date <= ?")
        params.append(date_to)

    where_clause = "WHERE " + " AND ".join(conditions)

    sql = f"""
        SELECT
            SUM(QCCard_QTY * Labor_Cost)                                              AS Cost_Total,
            COUNT(*)                                                                   AS cnt,
            SUM(CASE WHEN Posted_Mark = 0x01 THEN 1 ELSE 0 END)                      AS cnt_posted,
            SUM(CASE WHEN Posted_Mark = 0x01 THEN QCCard_QTY * Labor_Cost ELSE 0 END) AS Cost_Posted
        FROM QC.QC_Cards_Summary
        {where_clause}
    """

    with get_connection() as conn:
        rows = _fetch_query(conn, sql, tuple(params))
        return rows[0] if rows else {"Cost_Total": None, "cnt": None, "cnt_posted": None, "Cost_Posted": None}


def fetch_defect_cards_by_type(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> List[Dict[str, Any]]:
    conditions = ["Delete_Mark = ?"]
    params: list = [b'\x00']

    if date_from:
        conditions.append("Create_Date >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("Create_Date <= ?")
        params.append(date_to)

    where_clause = "WHERE " + " AND ".join(conditions)

    sql = f"""
        SELECT
            Defect_TypeRu,
            Defect_TypeZh,
            SUM(QCCard_QTY * Labor_Cost) AS Cost_Total
        FROM QC.QC_Cards_Summary
        {where_clause}
        GROUP BY Defect_TypeRu, Defect_TypeZh
        ORDER BY Cost_Total DESC
    """

    with get_connection() as conn:
        return _fetch_query(conn, sql, tuple(params))
