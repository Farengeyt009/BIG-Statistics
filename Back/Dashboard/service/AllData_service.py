"""
Сервис-слой для Dashboard: объединяет все данные дашборда в один запрос.
Выполняет все сервисы параллельно для оптимизации производительности.
"""

import concurrent.futures
import time
from typing import Any, Dict
from datetime import date
from ...orders.service.OrderData.OrderStatistics_service import get_statistics_data
from .PlanSummary_service import get_dashboard_plan_summary
from .OrdersSummary_service import get_dashboard_orders_summary
from .SalePlanYTD_service import get_dashboard_saleplan_ytd
from .ShipmentPlan_service import get_dashboard_shipment_plan
from .TimeLossTopReasons_service import get_dashboard_timeloss_top_reasons
from .RegionsMonthlyData_service import get_regions_monthly_data


def get_dashboard_all_data(user_id: int, year: int = None, month: int = None) -> Dict[str, Any]:
    """
    Возвращает все данные дашборда в одном запросе.
    Выполняет все сервисы параллельно для оптимизации производительности.
    
    Args:
        user_id: ID пользователя для применения правил отчета
        year: Год (опционально, по умолчанию текущий)
        month: Месяц (опционально, по умолчанию текущий)
    
    Returns:
        Словарь со всеми данными дашборда:
        - plan_summary: данные месячного плана
        - orders_summary: данные по незавершенным заказам
        - sale_plan_ytd: YTD данные по плану продаж
        - shipment_plan: данные по плану отгрузки
        - time_loss_top_reasons: топ причин потерь времени
        - regions_monthly_data: данные по месяцам (отгрузка + производство)
    """
    start_total_time = time.time()
    
    today = date.today()
    if year is None:
        year = today.year
    if month is None:
        month = today.month
    
    # Оптимизация: получаем get_statistics_data один раз и передаем в сервисы
    start_stats_data_time = time.time()
    base_statistics_data = get_statistics_data(user_id, additional_filters=None)
    elapsed_stats_data = time.time() - start_stats_data_time
    print(f"⏱️ [Dashboard] get_statistics_data: {elapsed_stats_data:.3f}s")
    
    # Выполняем все сервисы параллельно
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        # Планируем выполнение всех задач
        future_plan_summary = executor.submit(get_dashboard_plan_summary, year, month)
        future_orders_summary = executor.submit(get_dashboard_orders_summary, user_id, base_statistics_data)
        future_sale_plan_ytd = executor.submit(get_dashboard_saleplan_ytd, user_id, base_statistics_data)
        future_shipment_plan = executor.submit(get_dashboard_shipment_plan)
        future_time_loss = executor.submit(get_dashboard_timeloss_top_reasons, year, month)
        future_regions = executor.submit(get_regions_monthly_data, year)
        
        results = {}
        
        # Собираем результаты
        try:
            results['plan_summary'] = future_plan_summary.result()
        except Exception as exc:
            print(f"❌ [Dashboard] PlanSummary error: {exc}")
            results['plan_summary'] = None
        
        try:
            results['orders_summary'] = future_orders_summary.result()
        except Exception as exc:
            print(f"❌ [Dashboard] OrdersSummary error: {exc}")
            results['orders_summary'] = None
        
        try:
            results['sale_plan_ytd'] = future_sale_plan_ytd.result()
        except Exception as exc:
            print(f"❌ [Dashboard] SalePlanYTD error: {exc}")
            results['sale_plan_ytd'] = None
        
        try:
            results['shipment_plan'] = future_shipment_plan.result()
        except Exception as exc:
            print(f"❌ [Dashboard] ShipmentPlan error: {exc}")
            results['shipment_plan'] = None
        
        try:
            results['time_loss_top_reasons'] = future_time_loss.result()
        except Exception as exc:
            print(f"❌ [Dashboard] TimeLossTopReasons error: {exc}")
            results['time_loss_top_reasons'] = None
        
        try:
            results['regions_monthly_data'] = future_regions.result()
        except Exception as exc:
            print(f"❌ [Dashboard] RegionsMonthlyData error: {exc}")
            results['regions_monthly_data'] = None
    
    elapsed_total_time = time.time() - start_total_time
    print(f"⏱️ [Dashboard] Total time: {elapsed_total_time:.3f}s")
    print("==================================================")
    
    return results

