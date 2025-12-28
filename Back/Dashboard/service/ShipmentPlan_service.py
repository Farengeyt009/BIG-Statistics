"""
Сервис-слой для Dashboard: возвращает данные по плану и факту отгрузки.

Возвращаемая структура:
{
    "month_plan": 10000,      # Сумма ShipMonth_PlanPcs за весь месяц
    "month_fact": 8500,        # Сумма ShipQty за весь месяц
    "week_plan": 2500,         # План текущей недели (ShipWeek_PlanPcs)
    "current_week": 3          # Номер текущей недели из Ref.WeekSegments
}
"""

import datetime as _dt
from typing import Any, Dict
from ...database.db_connector import get_connection


def get_current_week_from_db(date: _dt.date) -> int | None:
    """
    Определяет номер текущей недели из таблицы Ref.WeekSegments.
    Ищет запись, где дата попадает в диапазон WeekStartDay <= date <= WeekFinishDay.
    
    Returns:
        WeekNo из базы данных или None, если не найдено
    """
    sql = """
        SELECT TOP 1 WeekNo
        FROM Ref.WeekSegments
        WHERE ? >= WeekStartDay AND ? <= WeekFinishDay
        ORDER BY WeekStartDay DESC
    """
    
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, (date, date))
            row = cur.fetchone()
            if row:
                return int(row[0])
            return None
    except Exception:
        return None


def get_dashboard_shipment_plan() -> Dict[str, Any]:
    """
    Возвращает данные по плану и факту отгрузки для текущего месяца и недели.
    Использует Ref.WeekSegments для определения текущей недели.
    
    Returns:
        Словарь с данными по плану и факту
    """
    today = _dt.date.today()
    current_year = today.year
    current_month = today.month
    current_week = get_current_week_from_db(today)
    
    # Если не удалось определить неделю из БД, используем ISO week как fallback
    if current_week is None:
        iso_year, iso_week, _ = today.isocalendar()
        current_week = iso_week
    
    sql = """
        SELECT 
            WeekNo, 
            SUM(ShipMonth_PlanPcs) as Month_Plan, 
            SUM(ShipWeek_PlanPcs) as Week_Plan, 
            SUM(ShipQty) as Fact
        FROM Orders.ShipmentPlan_Fact
        WHERE YearNum = ? AND MonthNum = ?
        GROUP BY WeekNo
        ORDER BY WeekNo
    """
    
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, (current_year, current_month))
            rows = cur.fetchall()
            
            # Инициализация итоговых значений
            month_plan_total = 0
            month_fact_total = 0
            week_plan = 0
            week_fact = 0  # Факт текущей недели
            week_plan_total = 0  # Сумма всех недельных планов за месяц
            weeks_data = []  # Данные по неделям для графиков
            
            # Обрабатываем строки
            for row in rows:
                week_no = row[0] if row[0] is not None else None
                
                # Безопасное преобразование с обработкой None, Decimal и других типов
                try:
                    month_plan = float(row[1]) if row[1] is not None else 0.0
                except (TypeError, ValueError):
                    month_plan = 0.0
                
                try:
                    week_plan_val = float(row[2]) if row[2] is not None else 0.0
                except (TypeError, ValueError):
                    week_plan_val = 0.0
                
                try:
                    fact = float(row[3]) if row[3] is not None else 0.0
                except (TypeError, ValueError):
                    fact = 0.0
                
                # Суммируем план и факт за весь месяц
                month_plan_total += month_plan
                month_fact_total += fact
                
                # Суммируем все недельные планы (важно: суммируем для всех недель)
                week_plan_total += week_plan_val
                
                # Сохраняем данные по неделе для графиков
                if week_no is not None:
                    weeks_data.append({
                        "week_no": week_no,
                        "month_plan": month_plan,
                        "week_plan": week_plan_val,
                        "fact": fact
                    })
                
                # Если это текущая неделя, сохраняем план и факт недели
                if week_no is not None and week_no == current_week:
                    week_plan = week_plan_val
                    week_fact = fact
            
            # Убеждаемся, что week_plan_total не меньше week_plan (если есть данные для текущей недели)
            if week_plan > 0 and week_plan_total == 0:
                # Если week_plan есть, но week_plan_total = 0, значит проблема в суммировании
                # В этом случае используем week_plan как минимальное значение
                week_plan_total = week_plan
            
            return {
                "month_plan": month_plan_total,
                "month_fact": month_fact_total,
                "week_plan": week_plan,
                "week_fact": week_fact,  # Факт текущей недели
                "week_plan_total": week_plan_total,  # Сумма всех недельных планов за месяц
                "weeks_data": weeks_data,  # Данные по неделям для графиков
                "current_week": current_week,
                "year": current_year,
                "month": current_month
            }
    except Exception as exc:
        raise Exception(f"Failed to fetch Shipment Plan data: {exc}")

