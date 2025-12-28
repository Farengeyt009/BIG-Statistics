"""
Сервис-слой для Dashboard: возвращает упрощенные агрегаты план/факт за текущий месяц.

Возвращаемая структура:
{
    "groups": [
        {
            "large_group": "Water heater",
            "total_qty": {
                "plan": 1000,
                "fact": 850,
                "percentage": 85
            },
            "total_time": {
                "plan": 500.5,
                "fact": 425.3,
                "percentage": 85
            }
        },
        {
            "large_group": "Heater",
            "total_qty": {
                "plan": 2000,
                "fact": 1800,
                "percentage": 90
            },
            "total_time": {
                "plan": 1000.0,
                "fact": 900.0,
                "percentage": 90
            }
        }
    ],
    "total_qty": {
        "plan": 3000,
        "fact": 2650,
        "percentage": 88.3
    },
    "total_time": {
        "plan": 1500.5,
        "fact": 1325.3,
        "percentage": 88.3
    }
}
"""

import calendar
import datetime as _dt
from typing import Any, Dict
from ...database.db_connector import get_connection


def _month_bounds(year: int, month: int) -> tuple[_dt.date, _dt.date]:
    """Первый и последний день указанного месяца."""
    first = _dt.date(year, month, 1)
    last = _dt.date(year, month, calendar.monthrange(year, month)[1])
    return first, last


def get_dashboard_plan_summary(year: int = None, month: int = None) -> Dict[str, Any]:
    """
    Возвращает упрощенные агрегаты план/факт.
    Если year/month не указаны, берется текущий месяц.
    """
    today = _dt.date.today()
    if year is None:
        year = today.year
    if month is None:
        month = today.month
    
    first_day, last_day = _month_bounds(year, month)
    
    # SQL запрос с группировкой по LargeGroup
    sql = """
        SELECT
            CASE 
                WHEN LargeGroup = 'Water heater' THEN 'Water heater'
                ELSE 'Heater'
            END AS LargeGroup,
            SUM(PlanQty)                        AS TotalPlanQty,
            SUM(FactQty)                        AS TotalFactQty,
            ROUND(
                CASE
                    WHEN SUM(PlanQty)=0 AND SUM(FactQty)=0 THEN 0
                    WHEN SUM(PlanQty)=0 AND SUM(FactQty)>0 THEN 100
                    WHEN SUM(PlanQty)=0 THEN 0
                    ELSE 100.0 * SUM(FactQty) / SUM(PlanQty)
                END, 1)                         AS PercentQty,
            SUM(PlanTime)                       AS TotalPlanTime,
            SUM(FactTime)                       AS TotalFactTime,
            ROUND(
                CASE
                    WHEN SUM(PlanTime)=0 AND SUM(FactTime)=0 THEN 0
                    WHEN SUM(PlanTime)=0 AND SUM(FactTime)>0 THEN 100
                    WHEN SUM(PlanTime)=0 THEN 0
                    ELSE 100.0 * SUM(FactTime) / SUM(PlanTime)
                END, 1)                         AS PercentTime
        FROM Views_For_Plan.Month_PlanFact_Summary
        WHERE [Date] BETWEEN ? AND ?
        GROUP BY 
            CASE 
                WHEN LargeGroup = 'Water heater' THEN 'Water heater'
                ELSE 'Heater'
            END
        ORDER BY LargeGroup;
    """
    
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(sql, (first_day, last_day))
        rows = cur.fetchall()
        
        if not rows:
            # Нет данных - возвращаем нули
            return {
                "groups": [],
                "total_qty": {
                    "plan": 0,
                    "fact": 0,
                    "percentage": 0
                },
                "total_time": {
                    "plan": 0,
                    "fact": 0,
                    "percentage": 0
                }
            }
        
        # Обрабатываем строки по группам
        groups = []
        total_plan_qty = 0.0
        total_fact_qty = 0.0
        total_plan_time = 0.0
        total_fact_time = 0.0
        
        for row in rows:
            large_group = row[0]
            plan_qty = float(row[1] or 0)
            fact_qty = float(row[2] or 0)
            percent_qty = float(row[3] or 0)
            plan_time = float(row[4] or 0)
            fact_time = float(row[5] or 0)
            percent_time = float(row[6] or 0)
            
            groups.append({
                "large_group": large_group,
                "total_qty": {
                    "plan": plan_qty,
                    "fact": fact_qty,
                    "percentage": percent_qty
                },
                "total_time": {
                    "plan": plan_time,
                    "fact": fact_time,
                    "percentage": percent_time
                }
            })
            
            # Суммируем для общих итогов
            total_plan_qty += plan_qty
            total_fact_qty += fact_qty
            total_plan_time += plan_time
            total_fact_time += fact_time
        
        # Рассчитываем общие проценты
        total_percent_qty = 0.0
        if total_plan_qty > 0:
            total_percent_qty = round((total_fact_qty / total_plan_qty) * 100, 1)
        
        total_percent_time = 0.0
        if total_plan_time > 0:
            total_percent_time = round((total_fact_time / total_plan_time) * 100, 1)
        
        return {
            "groups": groups,
            "total_qty": {
                "plan": total_plan_qty,
                "fact": total_fact_qty,
                "percentage": total_percent_qty
            },
            "total_time": {
                "plan": total_plan_time,
                "fact": total_fact_time,
                "percentage": total_percent_time
            }
        }

