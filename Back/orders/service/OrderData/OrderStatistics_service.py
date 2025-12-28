"""
Сервис для получения данных статистики заказов (Order Statistics)
Использует стандартный отчет с ID=1 для фильтрации данных
"""

import json
from typing import List, Dict, Any
from decimal import Decimal
from Back.database.db_connector import get_connection


def get_statistics_data(user_id: int, additional_filters: List[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Получает данные статистики заказов с применением стандартного фильтра (ReportID = 1).
    
    Args:
        user_id: ID пользователя (для проверки доступа к отчету)
        additional_filters: Дополнительные фильтры (например, RemainingToProduce_QTY > 0)
    
    Returns:
        Данные для построения статистики (графики, сводные таблицы)
    """
    # Получаем стандартный отчет с ID = 1
    report_sql = """
        SELECT ReportID, ReportName, SourceTable, SelectedFields, Filters, Grouping
        FROM Users.UserReports
        WHERE ReportID = 1 AND IsTemplate = 1
    """
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(report_sql)
        report_row = cursor.fetchone()
        
        if not report_row:
            # Если стандартного отчета нет - возвращаем все данные без фильтров
            return get_all_statistics_data()
        
        # Парсим настройки отчета
        selected_fields = json.loads(report_row.SelectedFields) if report_row.SelectedFields else []
        filters = json.loads(report_row.Filters) if report_row.Filters else []
        grouping = json.loads(report_row.Grouping) if report_row.Grouping else None
        
        # Объединяем фильтры отчета с дополнительными фильтрами
        if additional_filters:
            if isinstance(filters, list):
                filters.extend(additional_filters)
            else:
                filters = additional_filters
        
        # Генерируем SQL запрос с фильтрами
        sql_query = build_statistics_query(
            source_table=report_row.SourceTable,
            selected_fields=selected_fields,
            filters=filters,
            grouping=grouping
        )
        
        # Выполняем запрос
        cursor.execute(sql_query)
        
        # Получаем данные с форматированием
        columns = [col[0] for col in cursor.description]
        data = []
        
        for data_row in cursor.fetchall():
            row_dict = {}
            for col_name, value in zip(columns, data_row):
                # Форматируем данные для фронтенда
                row_dict[col_name] = format_value(value)
            data.append(row_dict)
        
        return {
            'report_id': report_row.ReportID,
            'report_name': report_row.ReportName,
            'columns': columns,
            'data': data,
            'total_records': len(data)
        }


def get_all_statistics_data() -> Dict[str, Any]:
    """
    Возвращает все данные без фильтров (fallback если отчет ID=1 не найден).
    
    Returns:
        Все данные из Orders.Orders_1C_Svod
    """
    sql = "SELECT * FROM Orders.Orders_1C_Svod"
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql)
        
        columns = [col[0] for col in cursor.description]
        data = []
        
        for data_row in cursor.fetchall():
            row_dict = {}
            for col_name, value in zip(columns, data_row):
                row_dict[col_name] = format_value(value)
            data.append(row_dict)
        
        return {
            'report_id': None,
            'report_name': 'All Orders (No Filter)',
            'columns': columns,
            'data': data,
            'total_records': len(data)
        }


def build_statistics_query(source_table: str, selected_fields: List[str], 
                          filters: Any, grouping: Any = None) -> str:
    """
    Генерирует SQL запрос для статистики.
    
    Args:
        source_table: Имя таблицы/VIEW (Orders.Orders_1C_Svod)
        selected_fields: Список полей для SELECT
        filters: Список фильтров
        grouping: Настройки группировки (опционально)
    
    Returns:
        SQL запрос
    """
    # SELECT часть
    if grouping and grouping.get('group_by'):
        # Если есть группировка - генерируем SELECT с агрегатными функциями
        select_parts = []
        
        # Добавляем поля группировки
        for field in grouping.get('group_by', []):
            select_parts.append(f"[{field}]")
        
        # Добавляем агрегатные функции
        for agg in grouping.get('aggregates', []):
            field = agg.get('field')
            func = agg.get('function', 'SUM')
            alias = agg.get('alias', f'{func}_{field}')
            
            if func == 'COUNT' and field == '*':
                select_parts.append(f"COUNT(*) AS [{alias}]")
            else:
                select_parts.append(f"{func}([{field}]) AS [{alias}]")
        
        select_clause = ", ".join(select_parts)
    elif not selected_fields or len(selected_fields) == 0:
        select_clause = "*"
    else:
        # Экранируем имена полей в квадратные скобки
        escaped_fields = [f"[{field}]" for field in selected_fields]
        select_clause = ", ".join(escaped_fields)
    
    # WHERE часть
    where_conditions = []
    
    if isinstance(filters, list):
        for filter_item in filters:
            field_name = filter_item.get('field')
            operator = filter_item.get('operator', 'equals')
            value = filter_item.get('value')
            
            if not field_name:
                continue
            
            # Пропускаем фильтры с пустыми значениями (кроме is_null и is_not_null)
            if operator not in ('is_null', 'is_not_null'):
                if value is None or value == '':
                    continue
            
            field_escaped = f"[{field_name}]"
            
            if operator == 'equals':
                where_conditions.append(f"{field_escaped} = N'{value}'")
            elif operator == 'not_equals':
                # Для not_equals также включаем NULL значения (как в build_report_query)
                where_conditions.append(f"({field_escaped} != N'{value}' OR {field_escaped} IS NULL)")
            elif operator == 'greater_than':
                try:
                    numeric_value = float(value)
                    where_conditions.append(f"{field_escaped} > {numeric_value}")
                except (ValueError, TypeError):
                    where_conditions.append(f"{field_escaped} > N'{value}'")
            elif operator == 'less_than':
                try:
                    numeric_value = float(value)
                    where_conditions.append(f"{field_escaped} < {numeric_value}")
                except (ValueError, TypeError):
                    where_conditions.append(f"{field_escaped} < N'{value}'")
            elif operator == 'greater_or_equal':
                try:
                    numeric_value = float(value)
                    where_conditions.append(f"{field_escaped} >= {numeric_value}")
                except (ValueError, TypeError):
                    where_conditions.append(f"{field_escaped} >= N'{value}'")
            elif operator == 'less_or_equal':
                try:
                    numeric_value = float(value)
                    where_conditions.append(f"{field_escaped} <= {numeric_value}")
                except (ValueError, TypeError):
                    where_conditions.append(f"{field_escaped} <= N'{value}'")
            elif operator == 'contains':
                where_conditions.append(f"{field_escaped} LIKE N'%{value}%'")
            elif operator == 'not_contains':
                # Для not_contains также включаем NULL значения (как в build_report_query)
                where_conditions.append(f"({field_escaped} NOT LIKE N'%{value}%' OR {field_escaped} IS NULL)")
            elif operator == 'starts_with':
                where_conditions.append(f"{field_escaped} LIKE N'{value}%'")
            elif operator == 'ends_with':
                where_conditions.append(f"{field_escaped} LIKE N'%{value}'")
            elif operator == 'is_null':
                where_conditions.append(f"{field_escaped} IS NULL")
            elif operator == 'is_not_null':
                where_conditions.append(f"{field_escaped} IS NOT NULL")
    
    # Собираем финальный SQL
    sql = f"SELECT {select_clause} FROM {source_table}"
    
    if where_conditions:
        sql += " WHERE " + " AND ".join(where_conditions)
    
    # GROUP BY часть
    if grouping and grouping.get('group_by'):
        group_by_fields = [f"[{field}]" for field in grouping.get('group_by', [])]
        sql += " GROUP BY " + ", ".join(group_by_fields)
    
    return sql


def format_value(value: Any) -> Any:
    """
    Форматирует значение для отправки на фронтенд.
    
    Args:
        value: Значение из базы данных
    
    Returns:
        Форматированное значение
    """
    if value is None:
        return None
    elif hasattr(value, 'isoformat'):  # datetime, date
        # Форматируем даты как DD.MM.YYYY
        if hasattr(value, 'strftime'):
            return value.strftime('%d.%m.%Y')
        else:
            return value.isoformat()
    elif isinstance(value, (bytes, bytearray)):  # binary
        return value.hex()
    elif isinstance(value, Decimal):
        # SQL Server decimal → число
        float_val = float(value)
        if float_val == int(float_val):
            return int(float_val)  # Целое число
        else:
            return round(float_val, 2)  # Округляем до 2 знаков
    elif isinstance(value, float):
        # Форматируем числа: убираем лишние нули
        if value == int(value):
            return int(value)  # Целое число
        else:
            return round(value, 2)  # Округляем до 2 знаков
    elif isinstance(value, int):
        return value  # Целые числа как есть
    else:
        return value


def get_statistics_metadata() -> Dict[str, Any]:
    """
    Возвращает метаданные для статистики (названия полей, типы данных).
    
    Returns:
        Метаданные таблицы Orders.Orders_1C_Svod
    """
    sql = "SELECT TOP 0 * FROM Orders.Orders_1C_Svod"
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql)
        
        fields = []
        for col in cursor.description:
            fields.append({
                'name': col[0],
                'type': str(col[1].__name__) if col[1] else 'unknown'
            })
        
        return {
            'fields': fields,
            'total_fields': len(fields)
        }

