"""
Сервис-слой для Dashboard: возвращает топ-5 причин потерь времени за текущий месяц.
"""

import calendar
import datetime as _dt
from typing import Any, Dict, List
from ...database.db_connector import get_connection


def _month_bounds(year: int, month: int) -> tuple[_dt.date, _dt.date]:
    """Первый и последний день указанного месяца."""
    first = _dt.date(year, month, 1)
    last = _dt.date(year, month, calendar.monthrange(year, month)[1])
    return first, last


def get_dashboard_timeloss_top_reasons(year: int = None, month: int = None) -> Dict[str, Any]:
    """
    Возвращает топ-5 причин потерь времени за указанный месяц и FACT_TIME для расчета эффективности.
    Если year/month не указаны, берется текущий месяц.
    
    Returns:
        Словарь с полями:
        - reasons: список словарей с полями:
            - reason_zh: название причины на китайском
            - reason_en: название причины на английском
            - total_hours: общее количество часов
        - fact_time: итоговый FACT_TIME (Production Fact) за период
    """
    today = _dt.date.today()
    if year is None:
        year = today.year
    if month is None:
        month = today.month
    
    first_day, last_day = _month_bounds(year, month)
    
    sql_reasons = """
        SELECT
            ReasonGroupZh,
            ReasonGroupEn,
            SUM(ManHours) AS TotalHours
        FROM TimeLoss.vw_EntryGrid
        WHERE OnlyDate >= ? AND OnlyDate <= ?
        GROUP BY ReasonGroupZh, ReasonGroupEn
    """
    
    sql_fact_time = """
        SELECT SUM(FACT_TIME) AS TotalFactTime
        FROM Views_For_Plan.DailyPlan_CustomWS
        WHERE OnlyDate >= ? AND OnlyDate <= ?
    """
    
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            
            # Получаем причины потерь
            cur.execute(sql_reasons, (first_day, last_day))
            rows = cur.fetchall()
            
            # Обрабатываем данные на бэкенде
            reasons = []
            for row in rows:
                reasons.append({
                    "reason_zh": (row[0] or '').strip() if row[0] else '',
                    "reason_en": (row[1] or '').strip() if row[1] else '',
                    "total_hours": float(row[2]) if row[2] is not None else 0.0
                })
            
            # Сортируем по убыванию TotalHours
            reasons.sort(key=lambda x: x['total_hours'], reverse=True)
            
            # Получаем FACT_TIME
            cur.execute(sql_fact_time, (first_day, last_day))
            fact_row = cur.fetchone()
            fact_time = float(fact_row[0]) if fact_row and fact_row[0] is not None else 0.0
            
            return {
                "reasons": reasons,
                "fact_time": fact_time
            }
    except Exception as exc:
        raise Exception(f"Failed to fetch Time Loss Top Reasons data: {exc}")

