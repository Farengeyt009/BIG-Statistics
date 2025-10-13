"""
Сервис для работы с пользовательскими отчетами заказов
"""

import json
from typing import List, Dict, Any, Optional
from decimal import Decimal
from Back.database.db_connector import get_connection


def get_user_reports(user_id: int) -> List[Dict[str, Any]]:
    """
    Получает список отчетов для пользователя:
    - Все стандартные отчеты (IsTemplate = 1)
    - Личные отчеты этого пользователя (UserID = user_id AND IsTemplate = 0)
    
    Args:
        user_id: ID пользователя
    
    Returns:
        Список отчетов
    """
    sql = """
        SELECT 
            ReportID,
            UserID,
            ReportName,
            SourceTable,
            SelectedFields,
            Filters,
            Grouping,
            IsTemplate,
            IsEditable,
            CreatedAt,
            UpdatedAt,
            CASE 
                WHEN IsTemplate = 1 THEN N'Стандартный'
                ELSE N'Личный'
            END AS ReportType,
            CASE 
                -- Личный отчет - может редактировать владелец
                WHEN IsTemplate = 0 AND UserID = ? THEN 1
                -- Стандартный отчет - может редактировать если есть право orders_orderlog_edit
                WHEN IsTemplate = 1 AND (
                    -- Проверяем право на редактирование стандартных отчетов
                    EXISTS (
                        SELECT 1 FROM Users.UserPagePermissions 
                        WHERE UserID = ? AND PageKey = 'orders_orderlog_edit' AND CanEdit = 1
                    )
                    -- Или пользователь - администратор
                    OR EXISTS (
                        SELECT 1 FROM Users.Users WHERE UserID = ? AND IsAdmin = 1
                    )
                ) THEN 1
                ELSE 0
            END AS CanEdit
        FROM Users.UserReports
        WHERE 
            IsTemplate = 1                          -- Все стандартные отчеты
            OR (UserID = ? AND IsTemplate = 0)      -- ИЛИ личные отчеты пользователя
        ORDER BY IsTemplate DESC, ReportName
    """
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, (user_id, user_id, user_id, user_id))
        
        reports = []
        for row in cursor.fetchall():
            # Парсим фильтры
            filters_data = json.loads(row.Filters) if row.Filters else []
            
            # Преобразуем старый формат (объект) в новый (массив) если нужно
            if isinstance(filters_data, dict):
                filters_array = []
                for field_name, filter_config in filters_data.items():
                    filters_array.append({
                        'field': field_name,
                        'operator': filter_config.get('operator', 'equals'),
                        'value': filter_config.get('value')
                    })
                filters_data = filters_array
            
            reports.append({
                'report_id': row.ReportID,
                'user_id': row.UserID,
                'report_name': row.ReportName,
                'source_table': row.SourceTable,
                'selected_fields': json.loads(row.SelectedFields) if row.SelectedFields else [],
                'filters': filters_data,
                'grouping': json.loads(row.Grouping) if row.Grouping else None,
                'is_template': bool(row.IsTemplate),
                'is_editable': bool(row.IsEditable),
                'created_at': row.CreatedAt.isoformat() if row.CreatedAt else None,
                'updated_at': row.UpdatedAt.isoformat() if row.UpdatedAt else None,
                'report_type': row.ReportType,
                'can_edit': bool(row.CanEdit)
            })
        
        return reports


def create_report(user_id: int, report_name: str, source_table: str, 
                 selected_fields: List[str], filters: Any, grouping: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Создает новый личный отчет пользователя.
    
    Args:
        user_id: ID пользователя
        report_name: Название отчета
        source_table: Источник данных
        selected_fields: Список выбранных полей
        filters: Объект с фильтрами
        grouping: Настройки группировки (опционально)
    
    Returns:
        Созданный отчет
    """
    sql = """
        INSERT INTO Users.UserReports (
            UserID, ReportName, SourceTable, SelectedFields, Filters, Grouping,
            IsTemplate, IsEditable, CreatedAt
        )
        OUTPUT INSERTED.ReportID
        VALUES (?, ?, ?, ?, ?, ?, 0, 1, GETDATE())
    """
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, (
            user_id,
            report_name,
            source_table,
            json.dumps(selected_fields, ensure_ascii=False),
            json.dumps(filters, ensure_ascii=False),
            json.dumps(grouping, ensure_ascii=False) if grouping else None
        ))
        
        report_id = cursor.fetchone()[0]
        conn.commit()
        
        # Получаем созданный отчет
        cursor.execute("SELECT * FROM Users.UserReports WHERE ReportID = ?", (report_id,))
        row = cursor.fetchone()
        
        return {
            'report_id': row.ReportID,
            'user_id': row.UserID,
            'report_name': row.ReportName,
            'source_table': row.SourceTable,
            'selected_fields': json.loads(row.SelectedFields),
            'filters': json.loads(row.Filters),
            'is_template': bool(row.IsTemplate),
            'is_editable': bool(row.IsEditable),
            'created_at': row.CreatedAt.isoformat() if row.CreatedAt else None
        }


def update_report(report_id: int, user_id: int, report_name: Optional[str] = None,
                 selected_fields: Optional[List[str]] = None, 
                 filters: Optional[Any] = None,
                 grouping: Optional[Dict[str, Any]] = None,
                 is_admin: bool = False) -> Dict[str, Any]:
    """
    Обновляет отчет (только свои личные отчеты или администратор может всё).
    
    Args:
        report_id: ID отчета
        user_id: ID пользователя (для проверки владения)
        report_name: Новое название (опционально)
        selected_fields: Новый список полей (опционально)
        filters: Новые фильтры (опционально)
        grouping: Настройки группировки (опционально)
        is_admin: Это администратор? (может редактировать всё)
    
    Returns:
        Обновленный отчет
    """
    # Проверяем что отчет принадлежит пользователю и его можно редактировать
    check_sql = """
        SELECT IsTemplate, IsEditable, UserID
        FROM Users.UserReports
        WHERE ReportID = ?
    """
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(check_sql, (report_id,))
        row = cursor.fetchone()
        
        if not row:
            raise ValueError("Report not found")
        
        # Администратор может редактировать любые отчеты
        if not is_admin:
            if row.IsTemplate:
                raise PermissionError("Cannot edit standard report")
            
            if row.UserID != user_id:
                raise PermissionError("Cannot edit other user's report")
        
        # Формируем UPDATE запрос
        updates = []
        params = []
        
        if report_name is not None:
            updates.append("ReportName = ?")
            params.append(report_name)
        
        if selected_fields is not None:
            updates.append("SelectedFields = ?")
            params.append(json.dumps(selected_fields, ensure_ascii=False))
        
        if filters is not None:
            updates.append("Filters = ?")
            params.append(json.dumps(filters, ensure_ascii=False))
        
        if grouping is not None:
            updates.append("Grouping = ?")
            params.append(json.dumps(grouping, ensure_ascii=False) if grouping else None)
        
        if not updates:
            raise ValueError("Нет данных для обновления")
        
        updates.append("UpdatedAt = GETDATE()")
        params.append(report_id)
        
        update_sql = f"""
            UPDATE Users.UserReports
            SET {', '.join(updates)}
            WHERE ReportID = ?
        """
        
        cursor.execute(update_sql, params)
        conn.commit()
        
        # Получаем обновленный отчет
        cursor.execute("SELECT * FROM Users.UserReports WHERE ReportID = ?", (report_id,))
        row = cursor.fetchone()
        
        return {
            'report_id': row.ReportID,
            'report_name': row.ReportName,
            'selected_fields': json.loads(row.SelectedFields),
            'filters': json.loads(row.Filters),
            'updated_at': row.UpdatedAt.isoformat() if row.UpdatedAt else None
        }


def delete_report(report_id: int, user_id: int, is_admin: bool = False) -> bool:
    """
    Удаляет отчет (только свои личные отчеты или администратор может всё).
    
    Args:
        report_id: ID отчета
        user_id: ID пользователя (для проверки владения)
        is_admin: Это администратор? (может удалять любые отчеты)
    
    Returns:
        True если успешно удален
    """
    check_sql = """
        SELECT IsTemplate, UserID
        FROM Users.UserReports
        WHERE ReportID = ?
    """
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(check_sql, (report_id,))
        row = cursor.fetchone()
        
        if not row:
            raise ValueError("Report not found")
        
        # Администратор может удалять любые отчеты
        if not is_admin:
            if row.IsTemplate:
                raise PermissionError("Cannot delete standard report")
            
            if row.UserID != user_id:
                raise PermissionError("Cannot delete other user's report")
        
        # Удаляем
        cursor.execute("DELETE FROM Users.UserReports WHERE ReportID = ?", (report_id,))
        conn.commit()
        
        return True


def execute_report(report_id: int, user_id: int) -> Dict[str, Any]:
    """
    Выполняет отчет - генерирует SQL и возвращает данные.
    
    Args:
        report_id: ID отчета
        user_id: ID пользователя (для проверки доступа)
    
    Returns:
        Данные отчета
    """
    # Получаем отчет
    get_sql = """
        SELECT ReportID, ReportName, SourceTable, SelectedFields, Filters, Grouping, IsTemplate, UserID
        FROM Users.UserReports
        WHERE ReportID = ?
    """
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(get_sql, (report_id,))
        row = cursor.fetchone()
        
        if not row:
            raise ValueError("Отчет не найден")
        
        # Проверяем доступ (стандартный отчет или свой личный)
        if not row.IsTemplate and row.UserID != user_id:
            raise PermissionError("Нельзя выполнить чужой отчет")
        
        # Парсим настройки
        selected_fields = json.loads(row.SelectedFields) if row.SelectedFields else []
        filters = json.loads(row.Filters) if row.Filters else {}
        grouping = json.loads(row.Grouping) if row.Grouping else None
        
        # Генерируем SQL запрос
        sql_query = build_report_query(row.SourceTable, selected_fields, filters, grouping)
        
        # Логируем SQL для отладки
        print(f"=== EXECUTING REPORT SQL ===")
        print(f"Report: {row.ReportName}")
        print(f"Filters: {filters}")
        print(f"SQL: {sql_query}")
        print(f"============================")
        
        # Выполняем запрос
        cursor.execute(sql_query)
        
        # Получаем данные с форматированием
        columns = [col[0] for col in cursor.description]
        data = []
        for data_row in cursor.fetchall():
            row_dict = {}
            for col_name, value in zip(columns, data_row):
                # Сериализуем и форматируем данные
                if value is None:
                    row_dict[col_name] = None
                elif hasattr(value, 'isoformat'):  # datetime, date
                    # Форматируем даты как DD.MM.YYYY
                    if hasattr(value, 'strftime'):
                        row_dict[col_name] = value.strftime('%d.%m.%Y')
                    else:
                        row_dict[col_name] = value.isoformat()
                elif isinstance(value, (bytes, bytearray)):  # binary
                    row_dict[col_name] = value.hex()
                elif isinstance(value, Decimal):
                    # SQL Server decimal → число
                    float_val = float(value)
                    if float_val == int(float_val):
                        row_dict[col_name] = int(float_val)  # Целое число
                    else:
                        row_dict[col_name] = round(float_val, 2)  # Округляем до 2 знаков
                elif isinstance(value, float):
                    # Форматируем числа: убираем лишние нули
                    if value == int(value):
                        row_dict[col_name] = int(value)  # Целое число
                    else:
                        row_dict[col_name] = round(value, 2)  # Округляем до 2 знаков
                elif isinstance(value, int):
                    row_dict[col_name] = value  # Целые числа как есть
                else:
                    row_dict[col_name] = value
            data.append(row_dict)
        
        return {
            'report_id': row.ReportID,
            'report_name': row.ReportName,
            'columns': columns,
            'data': data,
            'total_records': len(data)
        }


def build_report_query(source_table: str, selected_fields: List[str], filters: Any, grouping: Optional[Dict[str, Any]] = None) -> str:
    """
    Генерирует SQL запрос на основе выбранных полей, фильтров и группировок.
    
    Args:
        source_table: Имя таблицы/VIEW
        selected_fields: Список полей для SELECT
        filters: Список фильтров или словарь (для обратной совместимости)
        grouping: Настройки группировки {"group_by": [...], "aggregates": [...]}
    
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
    
    # Поддержка обоих форматов: массив и объект (для обратной совместимости)
    if isinstance(filters, list):
        # Новый формат: массив фильтров
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
                where_conditions.append(f"{field_escaped} != N'{value}'")
            elif operator == 'greater_than':
                where_conditions.append(f"{field_escaped} > {value}")
            elif operator == 'less_than':
                where_conditions.append(f"{field_escaped} < {value}")
            elif operator == 'greater_or_equal':
                where_conditions.append(f"{field_escaped} >= {value}")
            elif operator == 'less_or_equal':
                where_conditions.append(f"{field_escaped} <= {value}")
            elif operator == 'between' and isinstance(value, list) and len(value) == 2:
                where_conditions.append(f"{field_escaped} BETWEEN N'{value[0]}' AND N'{value[1]}'")
            elif operator == 'contains':
                where_conditions.append(f"{field_escaped} LIKE N'%{value}%'")
            elif operator == 'not_contains':
                where_conditions.append(f"{field_escaped} NOT LIKE N'%{value}%'")
            elif operator == 'starts_with':
                where_conditions.append(f"{field_escaped} LIKE N'{value}%'")
            elif operator == 'ends_with':
                where_conditions.append(f"{field_escaped} LIKE N'%{value}'")
            elif operator == 'in' and isinstance(value, list):
                values_str = ", ".join([f"N'{v}'" for v in value])
                where_conditions.append(f"{field_escaped} IN ({values_str})")
            elif operator == 'is_null':
                where_conditions.append(f"{field_escaped} IS NULL")
            elif operator == 'is_not_null':
                where_conditions.append(f"{field_escaped} IS NOT NULL")
    elif isinstance(filters, dict):
        # Старый формат: объект фильтров (для обратной совместимости)
        for field_name, filter_config in filters.items():
            operator = filter_config.get('operator', 'equals')
            value = filter_config.get('value')
            
            field_escaped = f"[{field_name}]"
            
            if operator == 'equals':
                where_conditions.append(f"{field_escaped} = N'{value}'")
            elif operator == 'not_equals':
                where_conditions.append(f"{field_escaped} != N'{value}'")
            elif operator == 'greater_than':
                where_conditions.append(f"{field_escaped} > {value}")
            elif operator == 'less_than':
                where_conditions.append(f"{field_escaped} < {value}")
            elif operator == 'greater_or_equal':
                where_conditions.append(f"{field_escaped} >= {value}")
            elif operator == 'less_or_equal':
                where_conditions.append(f"{field_escaped} <= {value}")
            elif operator == 'between' and isinstance(value, list) and len(value) == 2:
                where_conditions.append(f"{field_escaped} BETWEEN N'{value[0]}' AND N'{value[1]}'")
            elif operator == 'contains':
                where_conditions.append(f"{field_escaped} LIKE N'%{value}%'")
            elif operator == 'not_contains':
                where_conditions.append(f"{field_escaped} NOT LIKE N'%{value}%'")
            elif operator == 'starts_with':
                where_conditions.append(f"{field_escaped} LIKE N'{value}%'")
            elif operator == 'ends_with':
                where_conditions.append(f"{field_escaped} LIKE N'%{value}'")
            elif operator == 'in' and isinstance(value, list):
                values_str = ", ".join([f"N'{v}'" for v in value])
                where_conditions.append(f"{field_escaped} IN ({values_str})")
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


def get_available_fields(source_table: str) -> List[Dict[str, str]]:
    """
    Получает список доступных полей из VIEW/таблицы.
    
    Args:
        source_table: Имя таблицы/VIEW
    
    Returns:
        Список полей с типами
    """
    sql = f"""
        SELECT TOP 0 * FROM {source_table}
    """
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql)
        
        fields = []
        for col in cursor.description:
            fields.append({
                'name': col[0],
                'type': str(col[1].__name__) if col[1] else 'unknown'
            })
        
        return fields

