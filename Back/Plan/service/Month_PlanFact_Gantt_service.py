# Month_PlanFact_Gantt_service.py
"""Сервис‑слой: готовит структуру данных «план / факт» для гант‑таблицы.

Добавлены поля:
* **order_qty**        – Import_1C.Order_1C.Order_QTY
* **total_fact_qty**   – Import_1C.Order_1C.Scan_QTY

В конце добавлена сортировка по `plan_start` (от старых к новым; пустые даты в конец).
"""

from __future__ import annotations

import calendar
import datetime as _dt
from collections import defaultdict
from typing import Any, Dict

from database.db_connector import get_connection

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _month_bounds(year: int, month: int) -> tuple[_dt.date, _dt.date]:
    """Возвращает первый и последний день указанного месяца."""
    first = _dt.date(year, month, 1)
    last = _dt.date(year, month, calendar.monthrange(year, month)[1])
    return first, last

# ---------------------------------------------------------------------------
# public api
# ---------------------------------------------------------------------------

def fetch_month_planfact(year: int, month: int) -> Dict[str, Any]:
    first_day, last_day = _month_bounds(year, month)

    sql = """
        SELECT  [Date], LargeGroup, Order_No, Article_number, Name_CN,
                MonthPlanPcs, FactPcs,
                Order_QTY,       -- из Order_1C
                TotalFACT_QTY    -- из Order_1C
        FROM    Views_For_Plan.Month_PlanFact
        WHERE   [Date] BETWEEN ? AND ?
        ORDER   BY Order_No, Article_number, [Date];
    """

    # ключ = (order_no, article_number)
    orders: Dict[tuple[str, str], Dict[str, Any]] = defaultdict(
        lambda: {
            "order_no": "",
            "article_number": "",
            "name": "",
            "large_group": "",
            "order_qty": 0,
            "total_fact_qty": 0,
            "total_plan": 0,
            "total_fact": 0,
            "plan_start": None,
            "plan_finish": None,
            "fact_start": None,
            "fact_finish": None,
            "daily": {},  # yyyy-mm-dd -> {plan, fact}
        }
    )

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(sql, first_day, last_day)
        for row in cur:
            key = (row.Order_No.strip(), row.Article_number.strip())
            rec = orders[key]

            # статические поля (заполняются один раз)
            rec["order_no"] = row.Order_No.strip()
            rec["article_number"] = row.Article_number.strip()
            rec["name"] = row.Name_CN
            rec["large_group"] = row.LargeGroup
            rec["order_qty"] = int(row.Order_QTY or 0)
            rec["total_fact_qty"] = int(row.TotalFACT_QTY or 0)

            # ежедневные значения
            rec["daily"][row.Date.isoformat()] = {
                "plan": int(row.MonthPlanPcs or 0),
                "fact": int(row.FactPcs or 0),
            }

            # суммируем
            plan = int(row.MonthPlanPcs or 0)
            fact = int(row.FactPcs or 0)
            rec["total_plan"] += plan
            rec["total_fact"] += fact

            # даты плана
            if plan > 0:
                if rec["plan_start"] is None or row.Date < rec["plan_start"]:
                    rec["plan_start"] = row.Date
                if rec["plan_finish"] is None or row.Date > rec["plan_finish"]:
                    rec["plan_finish"] = row.Date

            # даты факта
            if fact > 0:
                if rec["fact_start"] is None or row.Date < rec["fact_start"]:
                    rec["fact_start"] = row.Date
                if rec["fact_finish"] is None or row.Date > rec["fact_finish"]:
                    rec["fact_finish"] = row.Date

    # финальная подготовка: ISO‑строки и условие fact_finish
    prepared: list[Dict[str, Any]] = []
    for rec in orders.values():
        rec["plan_start"] = rec["plan_start"].isoformat() if rec["plan_start"] else ""
        rec["plan_finish"] = rec["plan_finish"].isoformat() if rec["plan_finish"] else ""
        rec["fact_start"] = rec["fact_start"].isoformat() if rec["fact_start"] else ""
        rec["fact_finish"] = (
            rec["fact_finish"].isoformat()
            if rec["total_fact"] >= rec["total_plan"] and rec["fact_finish"]
            else ""
        )
        prepared.append(rec)

    # сортируем по плановой дате запуска (старые → новые, пустые в конец)
    prepared.sort(
        key=lambda r: (
            r["plan_start"] or "9999-12-31",
            r["order_no"],
            r["article_number"],
        )
    )

    return {
        "year": year,
        "month": f"{month:02d}",
        "data": prepared,
    }
