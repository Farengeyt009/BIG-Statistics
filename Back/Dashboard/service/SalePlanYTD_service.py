"""
Сервис-слой для Dashboard: возвращает YTD данные по Sale Plan.

Возвращаемая структура:
{
    "ytd_by_market": [
        {
            "market": "Russia",
            "ytd_plan": 150000,
            "ytd_fact": 120000,
            "ytd_diff": -30000
        },
        ...
    ]
}
"""

from datetime import date
from typing import Any, Dict
from ...database.db_connector import get_connection
from ...orders.service.OrderData.OrderStatistics_service import get_statistics_data


def get_dashboard_saleplan_ytd(user_id: int, base_statistics_data: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Возвращает YTD (Year To Date) данные по Sale Plan, сгруппированные по рынкам.
    Использует все фильтры из отчета "Все заказы" (ID=1).
    YTD = сумма всех месяцев от начала года до текущего месяца включительно.
    
    Args:
        user_id: ID пользователя для применения фильтров отчета
        base_statistics_data: Предзагруженные данные из get_statistics_data (опционально, для оптимизации)
    
    Returns:
        Словарь с YTD данными по рынкам
    """
    
    today = date.today()
    current_year = today.year
    current_month = today.month  # 1-12
    
    # Lead Time = 2 месяца (как в Plan vs Fact)
    lead_time_months = 2
    
    # Вычисляем target_month с учетом Lead Time
    # current_month (1-12) + lead_time_months
    target_month_calc = current_month + lead_time_months
    if target_month_calc > 12:
        # Переход в следующий год
        target_year_calc = current_year + 1
        target_month_calc = target_month_calc - 12
    else:
        target_year_calc = current_year
        # target_month_calc остается как есть
    
    # Логика для Dashboard: если текущий год < 2026, показываем YTD за 2026
    # С 2026 года и далее показываем YTD за target_year_calc (с учетом Lead Time)
    if current_year < 2026:
        # Показываем 2026 год
        target_year = 2026
        # Если target_year_calc == 2026, используем target_month_calc (январь + февраль = 2)
        # Если target_year_calc > 2026, значит Lead Time выходит за 2026, используем target_year_calc и target_month_calc
        if target_year_calc == 2026:
            target_month = target_month_calc  # Например, февраль = 2
        elif target_year_calc > 2026:
            target_year = target_year_calc
            target_month = target_month_calc
        else:
            # target_year_calc < 2026 (не должно быть, но на всякий случай)
            target_month = 12
    else:
        # С 2026 года используем target_year_calc и target_month_calc
        target_year = target_year_calc
        target_month = target_month_calc
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        # 1. Получаем план продаж (активная версия, YTD)
        # target_month уже вычислен выше с учетом Lead Time
        cur.execute("""
            SELECT 
                Market,
                SUM(QTY) AS YTD_Plan
            FROM Orders.vw_SalesPlan_Details
            WHERE YearNum = ? 
              AND MonthNum <= ?
              AND VersionID IN (
                  SELECT VersionID 
                  FROM Orders.SalesPlan_Versions 
                  WHERE MinYear = ? AND IsActive = 1
              )
            GROUP BY Market
        """, (target_year, target_month, target_year))
        
        plan_by_market = {}
        for row in cur.fetchall():
            market = row[0] or "Unknown"
            ytd_plan = float(row[1] or 0)
            plan_by_market[market] = ytd_plan
    
    # 2. Получаем факт размещения с применением ВСЕХ фильтров из отчета ID=1
    # Используем переданные данные или получаем сами (для обратной совместимости)
    if base_statistics_data is not None:
        result = base_statistics_data
    else:
        result = get_statistics_data(user_id, additional_filters=None)
    
    # Фильтруем и группируем по Market для YTD
    fact_by_market = {}
    
    for row in result.get('data', []):
        market = row.get('Market', 'Unknown')
        
        # Проверяем дату для YTD (только текущий год, месяц <= текущего)
        aggregated_date = row.get('AggregatedShipmentDate')
        if not aggregated_date:
            continue
        
        # Парсим дату (формат DD.MM.YYYY)
        try:
            if isinstance(aggregated_date, str):
                day, month, year = aggregated_date.split('.')
                date_year = int(year)
                date_month = int(month)
            else:
                # Если это datetime объект
                date_year = aggregated_date.year
                date_month = aggregated_date.month
            
            # Фильтр YTD: только target_year и месяц <= target_month (с учетом Lead Time)
            if date_year != target_year or date_month > target_month:
                continue
                
        except Exception:
            continue
        
        # Суммируем ToProduce_QTY
        to_produce = float(row.get('ToProduce_QTY', 0) or 0)
        
        if market in fact_by_market:
            fact_by_market[market] += to_produce
        else:
            fact_by_market[market] = to_produce
    
    # 3. Объединяем план и факт
    all_markets = set(plan_by_market.keys()) | set(fact_by_market.keys())
    
    ytd_by_market = []
    for market in all_markets:
        ytd_plan = plan_by_market.get(market, 0)
        ytd_fact = fact_by_market.get(market, 0)
        ytd_diff = ytd_fact - ytd_plan
        
        ytd_by_market.append({
            "market": market,
            "ytd_plan": ytd_plan,
            "ytd_fact": ytd_fact,
            "ytd_diff": ytd_diff
        })
    
    # Сортируем по абсолютному значению разницы (от большего к меньшему)
    ytd_by_market.sort(key=lambda x: abs(x['ytd_diff']), reverse=True)
    
    return {
        "ytd_by_market": ytd_by_market
    }
