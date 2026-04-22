"""
Сервис для работы с кастомными полями
"""
from Back.database.db_connector import get_connection
from typing import List, Dict, Optional
import json


class CustomFieldsService:
    
    @staticmethod
    def check_admin_access(project_id: int, user_id: int) -> bool:
        """
        Проверить, что пользователь - owner или admin проекта
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT role FROM Task_Manager.project_members
            WHERE project_id = ? AND user_id = ?
        """, (project_id, user_id))
        
        result = cursor.fetchone()
        is_admin = result and result[0] in ('owner', 'admin')
        
        cursor.close()
        conn.close()
        
        return is_admin
    
    # ============= ОПРЕДЕЛЕНИЯ ПОЛЕЙ =============
    
    @staticmethod
    def get_project_fields(project_id: int, user_id: int, active_only: bool = False) -> List[Dict]:
        """
        Получить все кастомные поля проекта
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        # Проверяем доступ
        cursor.execute("""
            SELECT 1 FROM Task_Manager.project_members WHERE project_id = ? AND user_id = ?
        """, (project_id, user_id))
        
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            raise PermissionError("Нет доступа к проекту")
        
        query = """
            SELECT 
                id,
                project_id,
                field_name,
                field_type,
                field_options,
                is_required,
                is_active,
                order_index,
                created_at
            FROM Task_Manager.custom_fields
            WHERE project_id = ?
        """
        
        if active_only:
            query += " AND is_active = 1"
        
        query += " ORDER BY order_index, id"
        
        cursor.execute(query, (project_id,))
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        
        return results
    
    @staticmethod
    def create_field(project_id: int, user_id: int, field_name: str, field_type: str,
                    field_options: Optional[str] = None) -> int:
        """
        Создать новое кастомное поле
        """
        if not CustomFieldsService.check_admin_access(project_id, user_id):
            raise PermissionError("Только owner или admin могут создавать поля")
        
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO Task_Manager.custom_fields 
                (project_id, field_name, field_type, field_options, created_by)
                OUTPUT INSERTED.id
                VALUES (?, ?, ?, ?, ?)
            """, (project_id, field_name, field_type, field_options, user_id))
            
            field_id = cursor.fetchone()[0]
            conn.commit()
            
            return field_id
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
    
    @staticmethod
    def update_field(field_id: int, user_id: int, field_name: Optional[str] = None,
                    field_options: Optional[str] = None,
                    is_active: Optional[bool] = None, order_index: Optional[int] = None) -> bool:
        """
        Обновить кастомное поле
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Получаем project_id
            cursor.execute("SELECT project_id FROM Task_Manager.custom_fields WHERE id = ?", (field_id,))
            result = cursor.fetchone()
            
            if not result:
                raise ValueError("Поле не найдено")
            
            project_id = result[0]
            
            if not CustomFieldsService.check_admin_access(project_id, user_id):
                raise PermissionError("Только owner или admin могут редактировать поля")
            
            updates = []
            params = []
            
            if field_name is not None:
                updates.append("field_name = ?")
                params.append(field_name)
            if field_options is not None:
                updates.append("field_options = ?")
                params.append(field_options)
            if is_active is not None:
                updates.append("is_active = ?")
                params.append(is_active)
            if order_index is not None:
                updates.append("order_index = ?")
                params.append(order_index)
            
            if updates:
                params.append(field_id)
                query = f"UPDATE Task_Manager.custom_fields SET {', '.join(updates)} WHERE id = ?"
                cursor.execute(query, params)
            
            conn.commit()
            return True
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
    
    @staticmethod
    def delete_field(field_id: int, user_id: int) -> bool:
        """
        Удалить кастомное поле
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Получаем project_id
            cursor.execute("SELECT project_id FROM Task_Manager.custom_fields WHERE id = ?", (field_id,))
            result = cursor.fetchone()
            
            if not result:
                raise ValueError("Поле не найдено")
            
            project_id = result[0]
            
            if not CustomFieldsService.check_admin_access(project_id, user_id):
                raise PermissionError("Только owner или admin могут удалять поля")
            
            # Сначала удаляем все значения этого поля
            cursor.execute("DELETE FROM Task_Manager.custom_field_values WHERE field_id = ?", (field_id,))
            
            # Потом удаляем само поле
            cursor.execute("DELETE FROM Task_Manager.custom_fields WHERE id = ?", (field_id,))
            conn.commit()
            
            return True
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
    
    # ============= ЗНАЧЕНИЯ ПОЛЕЙ =============
    
    @staticmethod
    def get_task_field_values(task_id: int, user_id: int) -> List[Dict]:
        """
        Получить значения кастомных полей для задачи (сгруппированные по строкам)
        Возвращает: { fields: [...], rows: [{row_index, values: {field_id: value}}, ...] }
        """
        conn = get_connection()
        cursor = conn.cursor()

        try:
            cursor.execute("""
                SELECT t.project_id
                FROM Task_Manager.tasks t
                INNER JOIN Task_Manager.project_members pm ON pm.project_id = t.project_id
                WHERE t.id = ? AND pm.user_id = ?
            """, (task_id, user_id))
            result = cursor.fetchone()
            if not result:
                cursor.execute("SELECT 1 FROM Task_Manager.tasks WHERE id = ?", (task_id,))
                if not cursor.fetchone():
                    raise ValueError("Задача не найдена")
                raise PermissionError("Нет доступа к проекту")

            project_id = result[0]

            # Получаем определения полей
            cursor.execute("""
                SELECT id as field_id, field_name, field_type, field_options, is_required
                FROM Task_Manager.custom_fields
                WHERE project_id = ? AND is_active = 1
                ORDER BY order_index, id
            """, (project_id,))
            field_cols = [c[0] for c in cursor.description]
            fields = [dict(zip(field_cols, row)) for row in cursor.fetchall()]

            # Получаем все значения по строкам
            cursor.execute("""
                SELECT field_id, value, row_index
                FROM Task_Manager.custom_field_values
                WHERE task_id = ?
                ORDER BY row_index, field_id
            """, (task_id,))
            raw_values = cursor.fetchall()
        finally:
            cursor.close()
            conn.close()
        
        # Группируем по row_index
        rows_map: dict = {}
        for field_id, value, row_index in raw_values:
            if row_index not in rows_map:
                rows_map[row_index] = {}
            rows_map[row_index][field_id] = value or ''
        
        # Если нет ни одной строки — возвращаем одну пустую
        if not rows_map and fields:
            rows_map[0] = {}
        
        rows = [
            {"row_index": ri, "values": rows_map[ri]}
            for ri in sorted(rows_map.keys())
        ]
        
        return {"fields": fields, "rows": rows}
    
    @staticmethod
    def get_all_task_values_for_project(project_id: int) -> Dict:
        """
        Получить все значения кастомных полей для всех задач проекта одним запросом.
        Возвращает: { task_id: { row_index: { field_id: value } } }
        """
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT cfv.task_id, cfv.field_id, cfv.row_index, cfv.value
            FROM Task_Manager.custom_field_values cfv
            INNER JOIN Task_Manager.tasks t ON t.id = cfv.task_id
            WHERE t.project_id = ?
            ORDER BY cfv.task_id, cfv.row_index, cfv.field_id
        """, (project_id,))

        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        result: Dict = {}
        for task_id, field_id, row_index, value in rows:
            result.setdefault(task_id, {}).setdefault(row_index, {})[field_id] = value or ''

        return result

    @staticmethod
    def save_task_rows(task_id: int, user_id: int,
                       rows: List[Dict]) -> bool:
        """
        Сохранить все строки значений для задачи.
        rows = [{"row_index": 0, "values": {field_id: value, ...}}, ...]
        Полностью заменяет текущие значения.
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT t.project_id, pm.role
                FROM Task_Manager.tasks t
                INNER JOIN Task_Manager.project_members pm ON t.project_id = pm.project_id
                WHERE t.id = ? AND pm.user_id = ?
            """, (task_id, user_id))
            result = cursor.fetchone()
            if not result:
                raise PermissionError("Нет доступа к задаче")
            if result[1] == 'viewer':
                raise PermissionError("Viewer не может редактировать поля")
            
            # Удаляем все текущие значения
            cursor.execute("DELETE FROM Task_Manager.custom_field_values WHERE task_id = ?", (task_id,))
            
            # Вставляем новые
            for row in rows:
                row_index = row.get("row_index", 0)
                values = row.get("values", {})
                for field_id, value in values.items():
                    if value is not None and value != '':
                        cursor.execute("""
                            INSERT INTO Task_Manager.custom_field_values
                                (task_id, field_id, value, row_index)
                            VALUES (?, ?, ?, ?)
                        """, (task_id, int(field_id), value, row_index))
            
            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close(); conn.close()

