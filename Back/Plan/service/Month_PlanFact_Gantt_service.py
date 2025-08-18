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

from Back.database.db_connector import get_connection

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _month_bounds(year: int, month: int) -> tuple[_dt.date, _dt.date]:
    """Возвращает первый и последний день указанного месяца."""
    first = _dt.date(year, month, 1)
    last = _dt.date(year, month, calendar.monthrange(year, month)[1])
    return first, last

def _format_date_ru(date_obj: _dt.date) -> str:
    """Форматирует дату в российском формате DD.MM.YYYY."""
    if date_obj is None:
        return ""
    return date_obj.strftime("%d.%m.%Y")

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
        FROM    Views_For_Plan.Month_PlanFact_Gantt
        WHERE   [Date] BETWEEN ? AND ?
          AND   (ISNULL(MonthPlanPcs, 0) > 0 OR ISNULL(FactPcs, 0) > 0)
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
            # Безопасная обработка NULL значений
            order_no = (row.Order_No or "").strip()
            article_number = (row.Article_number or "").strip()
            
            # Пропускаем записи с пустыми ключами
            if not order_no or not article_number:
                continue
                
            key = (order_no, article_number)
            rec = orders[key]

            # статические поля (заполняются один раз)
            rec["order_no"] = order_no
            rec["article_number"] = article_number
            rec["name"] = row.Name_CN or ""
            rec["large_group"] = row.LargeGroup or ""
            rec["order_qty"] = int(row.Order_QTY or 0)
            rec["total_fact_qty"] = int(row.TotalFACT_QTY or 0)

            # ежедневные значения
            rec["daily"][_format_date_ru(row.Date)] = {
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

    # финальная подготовка: российский формат дат и условие fact_finish
    prepared: list[Dict[str, Any]] = []
    for rec in orders.values():
        rec["plan_start"] = _format_date_ru(rec["plan_start"])
        rec["plan_finish"] = _format_date_ru(rec["plan_finish"])
        rec["fact_start"] = _format_date_ru(rec["fact_start"])
        rec["fact_finish"] = (
            _format_date_ru(rec["fact_finish"])
            if rec["total_fact"] >= rec["total_plan"] and rec["fact_finish"]
            else ""
        )
        prepared.append(rec)

    # сортируем по плановой дате запуска (старые → новые, пустые в конец)
    prepared.sort(
        key=lambda r: (
            r["plan_start"] or "31.12.9999",
            r["order_no"],
            r["article_number"],
        )
    )

    return {
        "year": year,
        "month": f"{month:02d}",
        "data": prepared,
    }
