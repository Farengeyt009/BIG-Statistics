"""
Сервис-слой: готовит три агрегата «план/факт» за выбранный месяц.

Возвращаемая структура:
{
    "year":  2025,
    "month": "01",
    "table1": [...],   # Market + LargeGroup
    "table2": [...],   # Market + LargeGroup + GroupName
    "table3": [...]    # дневная динамика трудоёмкости
}
"""

from __future__ import annotations

import calendar
import datetime as _dt
from typing import Any, Dict, List

# ◀─ три точки: Back.Plan.service ➜ Back.database
from ...database.db_connector import get_connection


# --------------------------------------------------------------------------- #
# helpers                                                                     #
# --------------------------------------------------------------------------- #
def _month_bounds(year: int, month: int) -> tuple[_dt.date, _dt.date]:
    """Первый и последний день указанного месяца."""
    first = _dt.date(year, month, 1)
    last = _dt.date(year, month, calendar.monthrange(year, month)[1])
    return first, last


def _fetch_query(conn, sql: str, *params) -> List[Dict[str, Any]]:
    """Выполняет SELECT и возвращает список dict'ов (JSON-friendly)."""
    cur = conn.cursor()
    cur.execute(sql, *params)
    cols = [c[0] for c in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


# --------------------------------------------------------------------------- #
# public API                                                                  #
# --------------------------------------------------------------------------- #
def fetch_planfact_summary(year: int, month: int) -> Dict[str, Any]:
    """Возвращает table1/2/3 для указанного года-месяца."""
    first_day, last_day = _month_bounds(year, month)

    # ---------- Table 1: LargeGroup only ----------
    sql_table1 = """
        SELECT
            LargeGroup,
            SUM(PlanQty)                        AS PlanQty,
            SUM(FactQty)                        AS FactQty,
            SUM(FactQty) - SUM(PlanQty)         AS DifferentQty,
            ROUND(
                CASE WHEN SUM(PlanQty)=0 THEN 0
                     ELSE 100.0 * (SUM(FactQty)-SUM(PlanQty)) / SUM(PlanQty)
                END, 1)                         AS PercentQty,
            SUM(PlanTime)                       AS PlanTime,
            SUM(FactTime)                       AS FactTime,
            SUM(FactTime) - SUM(PlanTime)       AS DifferentTime,
            ROUND(
                CASE WHEN SUM(PlanTime)=0 THEN 0
                     ELSE 100.0 * (SUM(FactTime)-SUM(PlanTime)) / SUM(PlanTime)
                END, 1)                         AS PercentTime
        FROM Views_For_Plan.Month_PlanFact_Summary
        WHERE [Date] BETWEEN ? AND ?
        GROUP BY LargeGroup
        ORDER BY LargeGroup;
    """

    # ---------- Table 2: Market + LargeGroup + GroupName ----------
    sql_table2 = """
        SELECT
            Market,
            LargeGroup,
            GroupName,
            SUM(PlanQty)                        AS PlanQty,
            SUM(FactQty)                        AS FactQty,
            SUM(FactQty) - SUM(PlanQty)         AS DifferentQty,
            ROUND(
                CASE WHEN SUM(PlanQty)=0 THEN 0
                     ELSE 100.0 * (SUM(FactQty)-SUM(PlanQty)) / SUM(PlanQty)
                END, 1)                         AS PercentQty,
            SUM(PlanTime)                       AS PlanTime,
            SUM(FactTime)                       AS FactTime,
            SUM(FactTime) - SUM(PlanTime)       AS DifferentTime,
            ROUND(
                CASE WHEN SUM(PlanTime)=0 THEN 0
                     ELSE 100.0 * (SUM(FactTime)-SUM(PlanTime)) / SUM(PlanTime)
                END, 1)                         AS PercentTime
        FROM Views_For_Plan.Month_PlanFact_Summary
        WHERE [Date] BETWEEN ? AND ?
        GROUP BY Market, LargeGroup, GroupName
        ORDER BY Market, LargeGroup, GroupName;
    """

    # ---------- Table 3: дневная динамика ----------
    sql_table3 = """
        SELECT
            CAST([Date] AS date)                AS [Date],
            SUM(PlanTime)                       AS PlanTime,
            SUM(DailyPlanTime)                  AS DailyPlanTime,
            SUM(FactTime)                       AS FactTime
        FROM Views_For_Plan.Month_PlanFact_Summary
        WHERE [Date] BETWEEN ? AND ?
        GROUP BY CAST([Date] AS date)
        ORDER BY [Date];
    """

    with get_connection() as conn:
        t1 = _fetch_query(conn, sql_table1, first_day, last_day)
        t2 = _fetch_query(conn, sql_table2, first_day, last_day)
        t3 = _fetch_query(conn, sql_table3, first_day, last_day)

    return {
        "year": year,
        "month": f"{month:02d}",
        "table1": t1,
        "table2": t2,
        "table3": t3,
    }
