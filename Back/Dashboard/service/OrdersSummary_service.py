"""
Сервис-слой для Dashboard: возвращает данные по рынкам (незавершенные заказы + план).

Возвращаемая структура:
{
    "orders_by_market": [
        {
            "market": "China",
            "uncompleted_orders": 5000,  # из Orders
            "plan_remaining": 1500       # из Monthly Plan
        },
        ...
    ]
}
"""

import calendar
import datetime as _dt
import json
from typing import Any, Dict
from ...database.db_connector import get_connection
from ...orders.service.OrderData.OrderStatistics_service import get_statistics_data


def _month_bounds(year: int, month: int) -> tuple[_dt.date, _dt.date]:
    """Первый и последний день указанного месяца."""
    first = _dt.date(year, month, 1)
    last = _dt.date(year, month, calendar.monthrange(year, month)[1])
    return first, last


def get_dashboard_orders_summary(user_id: int, base_statistics_data: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Возвращает данные по рынкам: незавершенные заказы + остаток по месячному плану.
    
    Args:
        user_id: ID пользователя для применения правил отчета
        base_statistics_data: Предзагруженные данные из get_statistics_data (опционально, для оптимизации)
    
    Returns:
        Словарь с данными по рынкам
    """
    
    # 1. Получаем незавершенные заказы из Orders (старое поле)
    # Если данные переданы, фильтруем в памяти, иначе делаем запрос
    if base_statistics_data is not None:
        # Фильтруем переданные данные в памяти
        filtered_data = [
            row for row in base_statistics_data.get('data', [])
            if float(row.get('RemainingToProduce_QTY', 0) or 0) > 0
        ]
        result = {
            'data': filtered_data
        }
    else:
        # Обратная совместимость: получаем данные сами
        additional_filters = [
            {
                "field": "RemainingToProduce_QTY",
                "operator": "greater_than",
                "value": "0"
            }
        ]
        result = get_statistics_data(user_id, additional_filters)
    
    # Группируем по Market
    uncompleted_by_market = {}
    for row in result.get('data', []):
        market = row.get('Market', 'Unknown')
        remaining = float(row.get('RemainingToProduce_QTY', 0) or 0)
        
        if market in uncompleted_by_market:
            uncompleted_by_market[market] += remaining
        else:
            uncompleted_by_market[market] = remaining
    
    # 2. Получаем остаток по месячному плану (новое поле)
    today = _dt.date.today()
    first_day, last_day = _month_bounds(today.year, today.month)
    
    sql_plan = """
        SELECT
            Market,
            SUM(
                CASE
                    WHEN PlanQty - FactQty < 0 THEN 0
                    ELSE PlanQty - FactQty
                END
            ) AS PlanRemaining
        FROM (
            SELECT
                Market,
                Order_No,
                Article_number,
                SUM(CASE WHEN PlanQty <> 0 THEN PlanQty ELSE 0 END) AS PlanQty,
                SUM(FactQty) AS FactQty
            FROM Views_For_Plan.Month_PlanFact_Summary
            WHERE [Date] BETWEEN ? AND ?
            GROUP BY Market, Order_No, Article_number
        ) Agg
        WHERE PlanQty <> 0
        GROUP BY Market
        HAVING SUM(
                CASE
                    WHEN PlanQty - FactQty < 0 THEN 0
                    ELSE PlanQty - FactQty
                END
            ) > 0
        ORDER BY Market;
    """
    
    plan_by_market = {}
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(sql_plan, first_day, last_day)
        
        for row in cur.fetchall():
            market = row[0] or "Unknown"
            plan_remaining = float(row[1] or 0)
            if plan_remaining > 0:
                plan_by_market[market] = plan_remaining
    
    # 3. Объединяем данные из обоих источников
    all_markets = set(uncompleted_by_market.keys()) | set(plan_by_market.keys())
    
    orders_by_market = []
    for market in all_markets:
        orders_by_market.append({
            "market": market,
            "uncompleted_orders": uncompleted_by_market.get(market, 0),
            "plan_remaining": plan_by_market.get(market, 0)
        })
    
    # Сортируем по убыванию незавершенных заказов
    orders_by_market.sort(key=lambda x: x['uncompleted_orders'], reverse=True)
    
    return {
        "orders_by_market": orders_by_market
    }

