"""
Service layer for Orders.ShipmentPlan_Fact

Public API:
    get_shipment_plan_fact(year: int, month: int) -> dict
"""

from typing import Any, Dict, List, Tuple
from ...database.db_connector import get_connection


def _rows_to_dicts(cursor, rows) -> List[Dict[str, Any]]:
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in rows]


def get_shipment_plan_fact(year: int, month: int, to_year: int | None = None, to_month: int | None = None) -> Dict[str, Any]:
    """Fetches data from Orders.ShipmentPlan_Fact filtered by month or by month range.

    If to_year/to_month are provided, returns rows for the inclusive range [year-month .. to_year-to_month].
    """
    if to_year is None or to_month is None:
        sql = (
            """
            SELECT *
            FROM Orders.ShipmentPlan_Fact
            WHERE YearNum = ? AND MonthNum = ?
            ORDER BY YearNum, MonthNum, WeekNo
            """
        )
        params: Tuple[Any, ...] = (year, month)
    else:
        sql = (
            """
            SELECT *
            FROM Orders.ShipmentPlan_Fact
            WHERE (
                    (YearNum > ?) OR (YearNum = ? AND MonthNum >= ?)
                  )
              AND (
                    (YearNum < ?) OR (YearNum = ? AND MonthNum <= ?)
                  )
            ORDER BY YearNum, MonthNum, WeekNo
            """
        )
        params = (year, year, month, to_year, to_year, to_month)
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, params)
            rows = cur.fetchall()
            data = _rows_to_dicts(cur, rows)
            return {
                "year": int(year),
                "month": int(month),
                "to_year": int(to_year) if to_year is not None else None,
                "to_month": int(to_month) if to_month is not None else None,
                "total": len(data),
                "data": data,
            }
    except Exception as exc:
        raise Exception(f"Failed to fetch ShipmentPlan_Fact: {exc}")


