"""
Сервис-слой: возвращает данные о эффективности производства из Views_For_Plan.DailyPlan_CustomWS
"""

from datetime import date
from typing import Any, Dict, List
from ...database.db_connector import get_connection


def _fetch_query(conn, sql: str, *params) -> List[Dict[str, Any]]:
    """Выполняет SELECT и возвращает список dict'ов (JSON-friendly)."""
    cur = conn.cursor()
    cur.execute(sql, *params)
    cols = [c[0] for c in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def get_production_efficiency_data(start_date: date, end_date: date) -> Dict[str, Any]:
    """
    Возвращает данные о эффективности производства за выбранный период
    
    Args:
        start_date: Начальная дата периода
        end_date: Конечная дата периода
    
    Returns:
        Словарь с данными о эффективности производства
    """
    
    # SQL запрос для получения данных о эффективности производства
    sql = """
    select
        OnlyDate,
        WorkShopName_CH,
        WorkCenter_Custom_CN as WorkCenterGroup_CN,
        case when WorkShopID IN (0xB5BC00505601355E11EDF92E2C3BF49A)
        then WorkCentor_CN
        else WorkCenter_Custom_CN
        end as WorkCentor_CN,
        OrderNumber,
        NomenclatureNumber,
        ProductName_CN,
        Plan_QTY,
        FACT_QTY,
        Plan_TIME,
        FACT_TIME
    from Views_For_Plan.DailyPlan_CustomWS
    WHERE OnlyDate between ? and ?
    ORDER BY OnlyDate, WorkShopName_CH, WorkCenter_Custom_CN, Line_No
    """
    
    try:
        with get_connection() as conn:
            data = _fetch_query(conn, sql, (start_date, end_date))
            
            # Форматируем даты в русский формат (DD.MM.YYYY)
            for row in data:
                if 'OnlyDate' in row and row['OnlyDate']:
                    # Преобразуем дату в русский формат
                    if isinstance(row['OnlyDate'], str):
                        # Если дата уже в строковом формате, парсим её
                        from datetime import datetime
                        try:
                            date_obj = datetime.fromisoformat(row['OnlyDate'].split('T')[0])
                            row['OnlyDate'] = date_obj.strftime('%d.%m.%Y')
                        except:
                            # Если не удалось распарсить, оставляем как есть
                            pass
                    elif hasattr(row['OnlyDate'], 'strftime'):
                        # Если это объект date
                        row['OnlyDate'] = row['OnlyDate'].strftime('%d.%m.%Y')
            
            return {
                "data": data,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "total_records": len(data)
            }
            
    except Exception as e:
        raise Exception(f"Ошибка при получении данных о эффективности производства: {str(e)}")


 