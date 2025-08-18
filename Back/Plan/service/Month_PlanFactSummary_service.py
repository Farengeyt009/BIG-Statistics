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


def _format_date_ru(date_obj) -> str:
    """Форматирует дату в российском формате DD.MM.YYYY."""
    if date_obj is None:
        return ""
    if hasattr(date_obj, 'strftime'):
        return date_obj.strftime("%d.%m.%Y")
    return str(date_obj)


# --------------------------------------------------------------------------- #
# public API                                                                  #
# --------------------------------------------------------------------------- #
def fetch_planfact_summary(year: int, month: int) -> Dict[str, Any]:
    """Возвращает table1/2 для указанного года-месяца."""
    first_day, last_day = _month_bounds(year, month)

    # ---------- Table 1: Market + LargeGroup + GroupName ----------
    sql_table1 = """
        SELECT
            Market,
            LargeGroup,
            GroupName,
            SUM(PlanQty)                        AS PlanQty,
            SUM(FactQty)                        AS FactQty,
            SUM(FactQty) - SUM(PlanQty)         AS DifferentQty,
            ROUND(
                CASE 
                    WHEN SUM(PlanQty)=0 AND SUM(FactQty)=0 THEN 0
                    WHEN SUM(PlanQty)=0 AND SUM(FactQty)>0 THEN 100
                    WHEN SUM(PlanQty)=0 THEN 0
                    ELSE 100.0 * SUM(FactQty) / SUM(PlanQty)
                END, 1)                         AS PercentQty,
            SUM(PlanTime)                       AS PlanTime,
            SUM(FactTime)                       AS FactTime,
            SUM(FactTime) - SUM(PlanTime)       AS DifferentTime,
            ROUND(
                CASE 
                    WHEN SUM(PlanTime)=0 AND SUM(FactTime)=0 THEN 0
                    WHEN SUM(PlanTime)=0 AND SUM(FactTime)>0 THEN 100
                    WHEN SUM(PlanTime)=0 THEN 0
                    ELSE 100.0 * SUM(FactTime) / SUM(PlanTime)
                END, 1)                         AS PercentTime
        FROM Views_For_Plan.Month_PlanFact_Summary
        WHERE [Date] BETWEEN ? AND ?
        GROUP BY Market, LargeGroup, GroupName
        ORDER BY Market, LargeGroup, GroupName;
    """

    # ---------- Table 2: дневная динамика по Water heater и Other ----------
    sql_table2 = """
        SELECT
            CAST([Date] AS date) AS [Date],
            SUM(CASE WHEN LargeGroup = 'Water heater' THEN PlanTime ELSE 0 END) AS WaterHeaterPlanTime,
            SUM(CASE WHEN LargeGroup != 'Water heater' THEN PlanTime ELSE 0 END) AS OtherPlanTime,
            SUM(CASE WHEN LargeGroup = 'Water heater' THEN FactTime ELSE 0 END) AS WaterHeaterFactTime,
            SUM(CASE WHEN LargeGroup != 'Water heater' THEN FactTime ELSE 0 END) AS OtherFactTime
        FROM Views_For_Plan.Month_PlanFact_Summary
        WHERE [Date] BETWEEN ? AND ?
        GROUP BY CAST([Date] AS date)
        ORDER BY [Date];
    """

    with get_connection() as conn:
        t1 = _fetch_query(conn, sql_table1, first_day, last_day)
        t2 = _fetch_query(conn, sql_table2, first_day, last_day)
        
        # Форматируем даты в таблице 2 в русский формат
        for row in t2:
            if 'Date' in row and row['Date']:
                row['Date'] = _format_date_ru(row['Date'])

    return {
        "year": year,
        "month": f"{month:02d}",
        "table1": t1,
        "table2": t2,
    }
