"""
Сервис-слой для Dashboard: возвращает данные по месяцам (отгрузка + факт производства) за текущий год
с применением опубликованных правил фильтрации для отгрузок.
"""

import datetime as _dt
from typing import Any, Dict, List
from ...database.db_connector import get_connection
from ...orders.service.Shipment_service import load_published_rules, _build_predicates_from_rules

# Sentinel для NullOrEmpty
NULL_EMPTY_SENTINEL = "__NULL_EMPTY__"


def get_regions_monthly_data(year: int = None) -> List[Dict[str, Any]]:
    """
    Возвращает данные по месяцам за указанный год:
    - Отгрузки (из Orders.ShipmentData_Table) с применением опубликованных правил
    - Факт производства (из Views_For_Plan.DailyPlan_CustomWS)
    
    Если year не указан, берется текущий год.
    
    Returns:
        Список словарей с полями:
        - month: номер месяца (1-12)
        - month_name: название месяца (Jan, Feb, ...)
        - shipment: сумма отгрузок за месяц
        - production_fact: факт производства за месяц
    """
    today = _dt.date.today()
    if year is None:
        year = today.year
    
    first_day = _dt.date(year, 1, 1)
    last_day = _dt.date(year, 12, 31)
    
    try:
        with get_connection() as conn:
            # Загружаем опубликованные правила
            rules = load_published_rules(conn)
            mapped_rules: List[Dict[str, Any]] = []
            for r in rules:
                if str(r.get("MatchType", "")).lower() == "equals" and str(r.get("Pattern", "")) == NULL_EMPTY_SENTINEL:
                    mapped_rules.append({**r, "MatchType": "NullOrEmpty", "Pattern": ""})
                else:
                    mapped_rules.append(r)
            
            # Строим условия фильтрации для отгрузок
            extra_sql, extra_params = _build_predicates_from_rules(mapped_rules)
            
            # SQL для отгрузок по месяцам с применением правил
            shipment_sql = f"""
                SELECT 
                    MONTH(ShipmentDate_Fact_Svod) AS Month,
                    SUM(COALESCE(SpendingOrder_QTY, 0)) AS TotalShipment
                FROM Orders.ShipmentData_Table
                WHERE ShipmentDate_Fact_Svod >= ? 
                  AND ShipmentDate_Fact_Svod <= ?
                  {extra_sql}
                GROUP BY MONTH(ShipmentDate_Fact_Svod)
                ORDER BY Month
            """
            
            # SQL для факта производства по месяцам
            production_sql = """
                SELECT 
                    MONTH([Date]) AS Month,
                    SUM(COALESCE(FactQty, 0)) AS TotalProductionFact
                FROM Views_For_Plan.Month_PlanFact_Summary
                WHERE [Date] >= ? 
                  AND [Date] <= ?
                GROUP BY MONTH([Date])
                ORDER BY Month
            """
            
            cur = conn.cursor()
            
            # Получаем отгрузки
            cur.execute(shipment_sql, (first_day, last_day, *extra_params))
            shipment_rows = cur.fetchall()
            shipment_map = {row[0]: float(row[1] or 0) for row in shipment_rows}
            
            # Получаем факт производства
            cur.execute(production_sql, (first_day, last_day))
            production_rows = cur.fetchall()
            production_map = {row[0]: float(row[1] or 0) for row in production_rows}
            
            # Формируем результат для всех 12 месяцев
            month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            
            result = []
            for month in range(1, 13):
                result.append({
                    "month": month,
                    "month_name": month_names[month - 1],
                    "shipment": shipment_map.get(month, 0.0),
                    "production_fact": production_map.get(month, 0.0)
                })
            
            return result
            
    except Exception as exc:
        raise Exception(f"Failed to fetch Regions Monthly Data: {exc}")

