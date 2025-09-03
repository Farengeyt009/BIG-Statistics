"""
Сервис-слой: возвращает данные для модального окна "Assign Work Schedules"
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


def _fetch_multiple_results(conn, sql: str, *params) -> List[List[Dict[str, Any]]]:
    """Выполняет SQL с несколькими результатами и возвращает список списков dict'ов."""
    cur = conn.cursor()
    cur.execute(sql, *params)
    
    results = []
    while True:
        cols = [c[0] for c in cur.description]
        rows = [dict(zip(cols, row)) for row in cur.fetchall()]
        results.append(rows)
        
        if not cur.nextset():
            break
    
    return results


def _time_to_str(time_obj) -> str:
    """Конвертирует время в строку формата HH:mm"""
    if time_obj is None:
        return "00:00"
    if isinstance(time_obj, str):
        return time_obj
    return time_obj.strftime('%H:%M')


def _minutes_to_hours(minutes: int) -> float:
    """Конвертирует минуты в часы с десятичной дробью"""
    if minutes is None:
        return 0.0
    return round(minutes / 60.0, 2)


def _to_iso_utc(datetime_obj) -> str:
    """Конвертирует datetime в ISO UTC строку"""
    if datetime_obj is None:
        return None
    if hasattr(datetime_obj, 'isoformat'):
        return datetime_obj.isoformat()
    return str(datetime_obj)


def get_assign_work_schedules_data(selected_date: date) -> Dict[str, Any]:
    """
    Возвращает данные для модального окна "Assign Work Schedules" на выбранную дату
    
    Args:
        selected_date: Выбранная дата для отображения данных
    
    Returns:
        Словарь с данными для модального окна:
        {
            "table1": [...], // Данные о цехах и рабочих центрах
            "table2": [...], // Графики работ с агрегированными данными
            "table3": [...], // Дополнительные данные (будет добавлено позже)
            "selected_date": "01.08.2025",
            "total_records": {...}
        }
    """
    
    # SQL запрос для Table1: получение списка цехов и рабочих центров с данными о выпуске
    sql_table1 = """
    ;WITH DP_Agg AS (
        SELECT
            WorkShopName_CH,
            WorkCenter_Custom_CN,
            SUM(Plan_QTY)  AS Plan_QTY,
            SUM(FACT_QTY)  AS FACT_QTY,
            SUM(Plan_TIME) AS Plan_TIME,
            SUM(FACT_TIME) AS FACT_TIME
        FROM Views_For_Plan.DailyPlan_CustomWS
        WHERE OnlyDate = ?
        GROUP BY WorkShopName_CH, WorkCenter_Custom_CN
    ),
    WSBD_Agg AS (
        SELECT
            WorkShopID,
            WorkCenterID,
            SUM(PeopleWorkHours) AS Shift_Time
        FROM TimeLoss.WorkSchedules_ByDay
        WHERE DeleteMark = 0                  -- активные строки
          AND OnlyDate   = ?
        GROUP BY WorkShopID, WorkCenterID
    )
    SELECT
        WS.WorkShop_CustomWS,
        WS.WorkCenter_CustomWS,
        WS.WorkShopName_ZH,
        WS.WorkShopName_EN,
        WS.WorkCenterName_ZH,
        WS.WorkCenterName_EN,
        COALESCE(DP.Plan_QTY,  0) AS Plan_QTY,
        COALESCE(DP.FACT_QTY,  0) AS FACT_QTY,
        COALESCE(DP.Plan_TIME, 0) AS Plan_TIME,
        COALESCE(DP.FACT_TIME, 0) AS FACT_TIME,
        COALESCE(WA.Shift_Time, 0) AS Shift_Time,
        CAST(0 AS int) AS Time_Loss
    FROM Ref.WorkShop_CustomWS AS WS
    LEFT JOIN DP_Agg  AS DP
           ON WS.WorkShop_CustomWS   = DP.WorkShopName_CH
          AND WS.WorkCenter_CustomWS = DP.WorkCenter_Custom_CN
    LEFT JOIN WSBD_Agg AS WA
           ON WS.WorkShop_CustomWS   = WA.WorkShopID
          AND WS.WorkCenter_CustomWS = WA.WorkCenterID
    ORDER BY WS.WorkShop_CustomWS, WS.WorkCenter_CustomWS
    """

    # SQL запрос для Table2: получение графиков работ с агрегированными данными
    sql_table2 = """
    SELECT 
        ws.ScheduleID,
        ws.ScheduleCode,
        ws.WorkShopID,
        ws.ScheduleName,
        ws.IsFavorite,
        ws.IsDeleted,
        ws.CreatedAt,
        ws.UpdatedAt,
        ws.CreatedBy,
        ws.UpdatedBy,
        -- Данные о рабочей смене (WORKSHIFT)
        workshift.StartTime AS WorkShiftStart,
        workshift.EndTime AS WorkShiftEnd,
        workshift.SpanMinutes AS WorkShiftSpanMinutes,
        -- Агрегированные данные о перерывах (BREAKS)
        breaks.BreaksCount,
        breaks.TotalBreakTime,
        -- Расчет рабочего времени (используем SpanMinutes вместо DATEDIFF)
        CASE 
            WHEN workshift.SpanMinutes IS NOT NULL 
            THEN workshift.SpanMinutes - COALESCE(breaks.TotalBreakTime, 0)
            ELSE 0 
        END AS NetWorkTime
    FROM TimeLoss.Working_Schedule ws
    LEFT JOIN (
        -- Получаем данные рабочей смены с SpanMinutes
        SELECT 
            ScheduleID,
            StartTime,
            EndTime,
            SpanMinutes
        FROM TimeLoss.Working_ScheduleType
        WHERE TypeID = 'WORKSHIFT'
    ) workshift ON ws.ScheduleID = workshift.ScheduleID
    LEFT JOIN (
        -- Агрегируем данные о перерывах с использованием SpanMinutes
        SELECT 
            ScheduleID,
            COUNT(*) AS BreaksCount,
            SUM(SpanMinutes) AS TotalBreakTime
        FROM TimeLoss.Working_ScheduleType
        WHERE TypeID = 'BREAKS'
        GROUP BY ScheduleID
    ) breaks ON ws.ScheduleID = breaks.ScheduleID
    WHERE ws.IsDeleted = 0
    ORDER BY ws.IsFavorite DESC, ws.ScheduleID DESC;
    """

    try:
        with get_connection() as conn:
            # Получаем данные для Table1 с передачей даты (два параметра для двух CTE)
            table1_data = _fetch_query(conn, sql_table1, (selected_date, selected_date))
            
            # Получаем данные для Table2 (графики работ с агрегированными данными)
            table2_data = _fetch_query(conn, sql_table2)
            
            # Обрабатываем данные table2
            processed_table2_data = []
            for schedule in table2_data:
                # Создаем объект с рабочей сменой и агрегированными перерывами
                processed_schedule = {
                    'scheduleId': schedule['ScheduleID'],
                    'scheduleCode': schedule['ScheduleCode'],
                    'workshopId': schedule['WorkShopID'],
                    'workShopId': schedule['WorkShopID'],  # алиас
                    'name': schedule['ScheduleName'],
                    'scheduleName': schedule['ScheduleName'],  # алиас
                    'isFavorite': bool(schedule['IsFavorite']),
                    'isDeleted': bool(schedule['IsDeleted']),
                    'createdAt': _to_iso_utc(schedule['CreatedAt']),
                    'updatedAt': _to_iso_utc(schedule['UpdatedAt']),
                    'createdBy': schedule['CreatedBy'],
                    'updatedBy': schedule['UpdatedBy'],
                    # Данные о рабочей смене
                    'workShift': {
                        'start': _time_to_str(schedule['WorkShiftStart']),
                        'end': _time_to_str(schedule['WorkShiftEnd'])
                    },
                    # Агрегированные данные о перерывах
                    'breaks': {
                        'count': schedule['BreaksCount'] or 0,
                        'totalHours': _minutes_to_hours(schedule['TotalBreakTime'] or 0)
                    },
                    # Расчетное поле: чистое рабочее время
                    'netWorkTime': {
                        'minutes': schedule['NetWorkTime'] or 0,
                        'hours': _minutes_to_hours(schedule['NetWorkTime'] or 0)
                    }
                }
                
                processed_table2_data.append(processed_schedule)
            
            # Форматируем выбранную дату в русский формат
            formatted_date = selected_date.strftime('%d.%m.%Y')
            
            return {
                "table1": table1_data,
                "table2": processed_table2_data,  # Графики работ с агрегированными данными
                "table3": [],  # Будет добавлено позже
                "selected_date": formatted_date,
                "total_records": {
                    "table1": len(table1_data),
                    "table2": len(processed_table2_data),
                    "table3": 0
                }
            }
            
    except Exception as e:
        raise Exception(f"Ошибка при получении данных для Assign Work Schedules: {str(e)}")


def get_assign_work_schedules_data_by_date_string(date_string: str) -> Dict[str, Any]:
    """
    Возвращает данные для модального окна "Assign Work Schedules" по строке даты
    
    Args:
        date_string: Дата в формате YYYY-MM-DD
    
    Returns:
        Словарь с данными для модального окна
    """
    try:
        selected_date = date.fromisoformat(date_string)
        return get_assign_work_schedules_data(selected_date)
    except ValueError:
        raise Exception(f"Неверный формат даты: {date_string}. Используйте формат YYYY-MM-DD")
