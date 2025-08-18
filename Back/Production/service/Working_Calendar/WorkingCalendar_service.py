"""
Сервис-слой: возвращает данные рабочего календаря из Views_For_Plan.DailyPlan_CustomWS
"""

from datetime import date
from typing import Any, Dict, List
from ....database.db_connector import get_connection


def _fetch_query(conn, sql: str, *params) -> List[Dict[str, Any]]:
    """Выполняет SELECT и возвращает список dict'ов (JSON-friendly)."""
    cur = conn.cursor()
    cur.execute(sql, *params)
    cols = [c[0] for c in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def get_working_calendar_data(year: int, month: int) -> Dict[str, Any]:
    """
    Возвращает данные рабочего календаря за выбранный год и месяц
    
    Args:
        year: Год (например, 2025)
        month: Месяц (1-12)
    
    Returns:
        Словарь с данными рабочего календаря
    """
    
    # SQL запрос для получения данных рабочего календаря
    # Фильтруем по году и месяцу, группируем по дате
    sql = """
    SELECT 
        OnlyDate, 
        SUM(FACT_TIME) AS Prod_Time, 
        CAST(270 AS int) AS Shift_Time, 
        CAST(50 AS int) AS Time_Loss, 
        CAST(27 AS int) AS People
    FROM Views_For_Plan.DailyPlan_CustomWS 
    WHERE YEAR(OnlyDate) = ? AND MONTH(OnlyDate) = ?
    GROUP BY OnlyDate 
    ORDER BY OnlyDate
    """
    
    try:
        with get_connection() as conn:
            data = _fetch_query(conn, sql, (year, month))
            
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
                "year": year,
                "month": month,
                "total_records": len(data)
            }
            
    except Exception as e:
        raise Exception(f"Ошибка при получении данных рабочего календаря: {str(e)}")


def get_working_calendar_data_by_date_range(start_date: date, end_date: date) -> Dict[str, Any]:
    """
    Возвращает данные рабочего календаря за выбранный период
    
    Args:
        start_date: Начальная дата периода
        end_date: Конечная дата периода
    
    Returns:
        Словарь с данными рабочего календаря
    """
    
    # SQL запрос для получения данных рабочего календаря за период
    sql = """
    SELECT 
        OnlyDate, 
        SUM(FACT_TIME) AS Prod_Time, 
        CAST(270 AS int) AS Shift_Time, 
        CAST(50 AS int) AS Time_Loss, 
        CAST(0 AS int) AS People
    FROM Views_For_Plan.DailyPlan_CustomWS 
    WHERE OnlyDate BETWEEN ? AND ?
    GROUP BY OnlyDate 
    ORDER BY OnlyDate
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
                "start_date": start_date.strftime('%d.%m.%Y'),
                "end_date": end_date.strftime('%d.%m.%Y'),
                "total_records": len(data)
            }
            
    except Exception as e:
        raise Exception(f"Ошибка при получении данных рабочего календаря: {str(e)}")
