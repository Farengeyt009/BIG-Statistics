"""
Service layer for Orders.ShipmentPlan_Fact

Public API:
    get_shipment_plan_fact(year: int, month: int) -> dict
"""

import threading
import time
from typing import Any, Dict, List, Tuple
from ...database.db_connector import get_connection

_CACHE_TTL_SEC = 10.0
_cache_lock = threading.Lock()
_shipment_plan_fact_cache: Dict[Tuple[int, int, int | None, int | None], Tuple[float, Dict[str, Any]]] = {}


def _rows_to_dicts(cursor, rows) -> List[Dict[str, Any]]:
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in rows]


def clear_shipment_plan_fact_cache() -> None:
    with _cache_lock:
        _shipment_plan_fact_cache.clear()


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
    cache_key = (int(year), int(month), int(to_year) if to_year is not None else None, int(to_month) if to_month is not None else None)
    now = time.time()
    with _cache_lock:
        cached = _shipment_plan_fact_cache.get(cache_key)
        if cached and now - cached[0] < _CACHE_TTL_SEC:
            return cached[1]
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, params)
            rows = cur.fetchall()
            data = _rows_to_dicts(cur, rows)
            payload = {
                "year": int(year),
                "month": int(month),
                "to_year": int(to_year) if to_year is not None else None,
                "to_month": int(to_month) if to_month is not None else None,
                "total": len(data),
                "data": data,
            }
            with _cache_lock:
                _shipment_plan_fact_cache[cache_key] = (time.time(), payload)
            return payload
    except Exception as exc:
        raise Exception(f"Failed to fetch ShipmentPlan_Fact: {exc}")


