"""
Service layer for Plastic Weight Summary.
Fetches data from QC.Plastic_Weight_Summary.
"""
from __future__ import annotations

import threading
import time
from typing import Any, Dict, List, Optional

from ...database.db_connector import get_connection

_CACHE_TTL_SEC = 10.0
_cache_lock = threading.Lock()
_cache: Dict[tuple, tuple[float, List[Dict[str, Any]]]] = {}


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


def fetch_plastic_wastes(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> List[Dict[str, Any]]:
    cache_key = (date_from or "", date_to or "")
    now = time.time()
    with _cache_lock:
        cached = _cache.get(cache_key)
        if cached and (now - cached[0]) < _CACHE_TTL_SEC:
            return cached[1]

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
            Price,
            FACT_QTY,
            WeightTotal_FACT,
            Cost_FACT,
            QCCard_Others_QTY,
            WeightOthers,
            CostOthers,
            WeightWastes_FACT,
            CostWastes_FACT,
            Debugging_QTY,
            WeightDebugging,
            CostDebugging,
            Weight_Total,
            Weight_Wastes,
            GP_Weight
        FROM QC.Plastic_Weight_Summary
        {where_clause}
        ORDER BY [Date] DESC, NomenclatureNumber
    """

    with get_connection() as conn:
        result = _fetch_query(conn, sql, tuple(params))

    with _cache_lock:
        _cache[cache_key] = (time.time(), result)
        # Keep cache compact in long-running process.
        if len(_cache) > 256:
            keys_to_delete = [
                key for key, (ts, _) in _cache.items()
                if (time.time() - ts) >= _CACHE_TTL_SEC
            ]
            for key in keys_to_delete:
                _cache.pop(key, None)

    return result
