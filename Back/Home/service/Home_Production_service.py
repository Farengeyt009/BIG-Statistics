"""
Сервис-слой: возвращает данные из Views_For_Plan.DailyPlan_CustomWS и Month_PlanFact_Summary
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


def _fetch_multiple_results(conn, sql: str, *params) -> List[List[Dict[str, Any]]]:
    """Выполняет SQL с несколькими результатами и возвращает список результатов."""
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


def get_production_data(selected_date: date = None) -> Dict[str, Any]:
    """
    Возвращает данные из Views_For_Plan.DailyPlan_CustomWS и Month_PlanFact_Summary
    
    Args:
        selected_date: Дата для фильтрации. Если None, используется сегодняшняя дата
    
    Returns:
        Словарь с двумя таблицами: table1 (данные по цехам) и table2 (суммарные данные)
    """
    if selected_date is None:
        selected_date = date.today()
    
    # SQL для первой таблицы (данные по цехам)
    sql_table1 = """
        WITH WC_1C AS (
            SELECT DISTINCT
                WorkShop_Cn,
                CASE
                    WHEN WorkShop_ID IN (
                        0xB5BC00505601355E11EDF0AED639127E, -- 冲压车间
                        0xB5BC00505601355E11EDF940AAEDDAA7  -- 装配车间
                    ) THEN WorkCenter_Cn
                    ELSE WorkCenter_Type_Cn
                END AS WorkCenter_Custom_CN,
                WorkShop_ID,
                CASE
                    WHEN WorkShop_ID IN (
                        0xB5BC00505601355E11EDF0AED639127E,
                        0xB5BC00505601355E11EDF940AAEDDAA7
                    ) THEN WorkCenter_ID
                    ELSE WorkCenter_Type_ID
                END AS WorkCenter_CustomID
            FROM Import_1C.WorkCenter_1C
        ),
        PlanData AS (
            SELECT
                WorkShopName_CH,
                WorkCenter_Custom_CN,
                OnlyDate,
                SUM(Plan_QTY)     AS Plan_QTY,
                SUM(FACT_QTY)     AS FACT_QTY,
                SUM(PLAN_TIME)    AS PLAN_TIME,
                SUM(FACT_TIME)    AS FACT_TIME
            FROM Views_For_Plan.DailyPlan_CustomWS
            WHERE OnlyDate = ?
            GROUP BY WorkShopName_CH, WorkCenter_Custom_CN, OnlyDate
        ),
        AllCenters AS (
            SELECT DISTINCT
                WorkShop_Cn,
                WorkCenter_Custom_CN
            FROM WC_1C
            UNION
            SELECT DISTINCT
                WorkShopName_CH,
                WorkCenter_Custom_CN
            FROM PlanData
        )

        SELECT
            ac.WorkShop_Cn,
            ac.WorkCenter_Custom_CN,
            pd.OnlyDate,
            pd.Plan_QTY,
            pd.FACT_QTY,
            pd.Plan_TIME,
            pd.FACT_TIME
        FROM AllCenters ac
        LEFT JOIN PlanData pd
            ON pd.WorkShopName_CH = ac.WorkShop_Cn
            AND pd.WorkCenter_Custom_CN = ac.WorkCenter_Custom_CN
        LEFT JOIN WC_1C wc
            ON wc.WorkShop_Cn = ac.WorkShop_Cn
            AND wc.WorkCenter_Custom_CN = ac.WorkCenter_Custom_CN
        ORDER BY ac.WorkShop_Cn, ac.WorkCenter_Custom_CN;
    """
    
    # SQL для второй таблицы (суммарные данные за месяц)
    sql_table2 = """
        DECLARE @selDate      date = ?;
        DECLARE @monthStart   date = DATEFROMPARTS(YEAR(@selDate),
                                                   MONTH(@selDate), 1);
        DECLARE @nextMonth    date = DATEADD(MONTH, 1, @monthStart);

        SELECT
               /* 1. План на выбранный месяц (SUM PlanQty) */
               ( SELECT COALESCE(SUM(PlanQty), 0)
                 FROM Views_For_Plan.Month_PlanFact_Summary
                 WHERE [Date] >= @monthStart
                   AND [Date] <  @nextMonth )          AS PlanQty_Month,

               /* 2. Факт с начала месяца по выбранный день (MTD) */
               ( SELECT COALESCE(SUM(FactQty), 0)
                 FROM Views_For_Plan.Month_PlanFact_Summary
                 WHERE [Date] >= @monthStart
                   AND [Date] <= @selDate )            AS FactQty_MTD,

               /* 3. Факт за конкретный выбранный день */
               ( SELECT COALESCE(SUM(FactQty), 0)
                 FROM Views_For_Plan.Month_PlanFact_Summary
                 WHERE [Date] =  @selDate )            AS FactQty_Day;
    """
    
    # SQL для третьей таблицы (данные о времени)
    sql_table3 = """
        /* --------------------------------------------------------------
           3‑я «карточка»: текущий месяц + предыдущий месяц в одной строке
           --------------------------------------------------------------
           @selDate – дата из Date‑Picker'а
        ---------------------------------------------------------------- */
        
        DECLARE @selDate          date = ?;                              -- ← параметр из Python
        
        /* ►  Текущий месяц */
        DECLARE @monthStart       date = DATEFROMPARTS(YEAR(@selDate),
                                                       MONTH(@selDate), 1);
        DECLARE @nextMonth        date = DATEADD(MONTH, 1, @monthStart); -- начало след. месяца
        
        /* ►  Предыдущий месяц */
        DECLARE @prevMonthStart   date = DATEADD(MONTH, -1, @monthStart);-- начало прошлого месяца
        DECLARE @prevNextMonth    date = @monthStart;                    -- граница прошлого месяца
        
        /* ------------------------------------------------
           Итоговая строка:
             • TimeLoss_Month       – потери времени за ТЕКУЩИЙ месяц
             • FactTime_MTD         – факт‑время с 1‑го числа до выбранного дня
             • TimeLoss_PrevMonth   – потери времени за ПРОШЛЫЙ месяц
             • FactTime_PrevMonth   – факт‑время за ПРОШЛЫЙ месяц
        ------------------------------------------------- */
        SELECT
               /* 1. Потери времени за текущий месяц */
               ( SELECT COALESCE(SUM(Time), 0)
                 FROM Views_For_TimeLoss.TimeLoss_AllTable
                 WHERE [Date] >= @monthStart
                   AND [Date] <  @nextMonth )          AS TimeLoss_Month,
        
               /* 2. Факт‑время month‑to‑date (1‑е число → @selDate) */
               ( SELECT COALESCE(SUM(FACT_TIME), 0)
                 FROM Views_For_Plan.DailyPlan_CustomWS
                 WHERE OnlyDate >= @monthStart
                   AND OnlyDate <= @selDate )          AS FactTime_MTD,
        
               /* 3. Потери времени за предыдущий месяц */
               ( SELECT COALESCE(SUM(Time), 0)
                 FROM Views_For_TimeLoss.TimeLoss_AllTable
                 WHERE [Date] >= @prevMonthStart
                   AND [Date] <  @prevNextMonth )      AS TimeLoss_PrevMonth,
        
               /* 4. Факт‑время за предыдущий месяц (полная сумма) */
               ( SELECT COALESCE(SUM(FACT_TIME), 0)
                 FROM Views_For_Plan.DailyPlan_CustomWS
                 WHERE OnlyDate >= @prevMonthStart
                   AND OnlyDate <  @prevNextMonth )    AS FactTime_PrevMonth;
    """
    
    # SQL для четвертой таблицы (детальные данные + агрегаты)
    sql_table4 = """
        /* -----------------------------------------------------------------
           4‑я таблица (деталь) + агрегаты TOTAL_* по цеху + линии
           -----------------------------------------------------------------
           @selDate – дата из Date‑Picker'а
        -------------------------------------------------------------------*/
        
        DECLARE @selDate date = ?;          -- например 2025‑07‑02
        
        /* ---------- ① детальные строки ----------------------------------- */
        SELECT
               DPF.OnlyDate,                    -- = @selDate
               DPF.WorkShopName_CH,
               DPF.WorkCentor_CN,
               DPF.OrderNumber,
               DPF.NomenclatureNumber,
               PG.GroupName,

               SUM(DPF.Plan_QTY)                                             AS Plan_QTY,
               SUM(FACT_QTY)                                                 AS FACT_QTY
        FROM  Views_For_Plan.DailyPlan_CustomWS AS DPF
        LEFT  JOIN Ref.Product_Guide   AS PG
               ON  DPF.NomenclatureNumber = PG.FactoryNumber
        WHERE (DPF.WorkShopName_CH = N'装配车间'
               OR DPF.WorkShopName_CH = N'热水器总装组')
          AND  DPF.OnlyDate = @selDate
        GROUP BY
               DPF.OnlyDate,
               DPF.WorkShopName_CH,
               DPF.WorkCentor_CN,
               DPF.Line_No,
               DPF.OrderNumber,
               DPF.NomenclatureNumber,
               PG.GroupName
        ORDER  BY WorkShopName_CH, WorkCentor_CN, Line_No, OrderNumber
        
        /* ---------- ② агрегаты TOTAL_* по WorkShopName_CH + WorkCentor_CN -*/
        SELECT
               DPF.WorkShopName_CH,
               DPF.WorkCentor_CN,
               SUM(DPF.Plan_QTY) AS TOTAL_Plan_QTY,
               SUM(FACT_QTY) AS TOTAL_FACT_QTY
        FROM  Views_For_Plan.DailyPlan_CustomWS AS DPF
        LEFT  JOIN Ref.Product_Guide   AS PG
               ON  DPF.NomenclatureNumber = PG.FactoryNumber
        WHERE (DPF.WorkShopName_CH = N'装配车间'
               OR DPF.WorkShopName_CH = N'热水器总装组')
          AND  DPF.OnlyDate = @selDate
        GROUP  BY DPF.WorkShopName_CH, DPF.WorkCentor_CN
        ORDER  BY DPF.WorkShopName_CH, DPF.WorkCentor_CN;
    """
    
    with get_connection() as conn:
        table1_data = _fetch_query(conn, sql_table1, selected_date)
        table2_data = _fetch_query(conn, sql_table2, selected_date)
        table3_data = _fetch_query(conn, sql_table3, selected_date)
        table4_results = _fetch_multiple_results(conn, sql_table4, selected_date)
    
    # table4_results содержит два результата: [детальные_данные, агрегаты]
    table4_details = table4_results[0] if len(table4_results) > 0 else []
    table4_totals = table4_results[1] if len(table4_results) > 1 else []
    
    # Форматируем даты в русский формат (DD.MM.YYYY)
    def format_dates_in_data(data_list):
        for row in data_list:
            if 'OnlyDate' in row and row['OnlyDate']:
                if isinstance(row['OnlyDate'], str):
                    from datetime import datetime
                    try:
                        date_obj = datetime.fromisoformat(row['OnlyDate'].split('T')[0])
                        row['OnlyDate'] = date_obj.strftime('%d.%m.%Y')
                    except:
                        pass
                elif hasattr(row['OnlyDate'], 'strftime'):
                    row['OnlyDate'] = row['OnlyDate'].strftime('%d.%m.%Y')
    
    # Форматируем даты во всех таблицах
    format_dates_in_data(table1_data)
    format_dates_in_data(table4_details)
    
    return {
        "table1": table1_data,
        "table2": table2_data[0] if table2_data else {},  # Берем первую (и единственную) запись
        "table3": table3_data[0] if table3_data else {},  # Берем первую (и единственную) запись
        "table4": {
            "details": table4_details,
            "totals": table4_totals
        },
        "selected_date": selected_date.strftime('%d.%m.%Y')
    } 