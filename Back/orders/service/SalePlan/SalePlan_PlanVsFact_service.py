"""
Service для получения данных Plan vs Fact (план продаж vs факт размещения)
"""
from typing import Dict, Any, List
from ....database.db_connector import get_connection
from ..OrderData.OrderStatistics_service import get_statistics_data


def get_plan_vs_fact_data(year: int, user_id: int) -> Dict[str, Any]:
    """
    Получить сравнение план продаж vs факт размещения для указанного года
    
    План: из Orders.vw_SalesPlan_Details (активная версия)
    Факт: из Orders.Orders_1C_Svod (фактические размещённые заказы)
    """
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            
            # 1. Получаем план продаж (активная версия для года)
            cur.execute("""
                SELECT 
                    YearNum,
                    MonthNum,
                    Market,
                    LargeGroup,
                    SUM(QTY) AS PlannedQty
                FROM Orders.vw_SalesPlan_Details
                WHERE YearNum = ? 
                  AND VersionID IN (
                      SELECT VersionID 
                      FROM Orders.SalesPlan_Versions 
                      WHERE MinYear = ? AND IsActive = 1
                  )
                GROUP BY YearNum, MonthNum, Market, LargeGroup
            """, (year, year))
            
            plan_rows = cur.fetchall()
            plan_data = []
            for row in plan_rows:
                plan_data.append({
                    'YearNum': row[0],
                    'MonthNum': row[1],
                    'Market': row[2],
                    'LargeGroup': row[3],
                    'PlannedQty': float(row[4]) if row[4] is not None else 0,
                })
            
            # 2. Получаем факт размещения с применением ВСЕХ фильтров из отчета ID=1
            result = get_statistics_data(user_id, additional_filters=None)
            
            # Группируем по Year, Month, Market, LargeGroup
            fact_grouped = {}
            
            for row in result.get('data', []):
                aggregated_date = row.get('AggregatedShipmentDate')
                if not aggregated_date:
                    continue
                
                # Парсим дату (формат DD.MM.YYYY)
                try:
                    if isinstance(aggregated_date, str):
                        day, month_str, year_str = aggregated_date.split('.')
                        row_year = int(year_str)
                        row_month = int(month_str)
                    else:
                        row_year = aggregated_date.year
                        row_month = aggregated_date.month
                    
                    # Фильтруем только нужный год
                    if row_year != year:
                        continue
                        
                except Exception:
                    continue
                
                market = row.get('Market', 'Unknown')
                large_group = row.get('LargeGroup', 'Unknown')
                to_produce = float(row.get('ToProduce_QTY', 0) or 0)
                
                key = (row_year, row_month, market, large_group)
                
                if key in fact_grouped:
                    fact_grouped[key] += to_produce
                else:
                    fact_grouped[key] = to_produce
            
            # Формируем fact_data из сгруппированных данных
            fact_data = []
            for (row_year, row_month, market, large_group), actual_qty in fact_grouped.items():
                fact_data.append({
                    'YearNum': row_year,
                    'MonthNum': row_month,
                    'Market': market,
                    'LargeGroup': large_group,
                    'ActualQty': actual_qty,
                })
            
            return {
                'success': True,
                'year': year,
                'plan': plan_data,
                'fact': fact_data,
            }
            
    except Exception as e:
        raise Exception(f"Ошибка при получении данных Plan vs Fact: {str(e)}")

