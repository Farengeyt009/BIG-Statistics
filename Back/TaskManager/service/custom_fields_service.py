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
                    field_options: Optional[str] = None, is_required: bool = False) -> int:
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
                (project_id, field_name, field_type, field_options, is_required, created_by)
                OUTPUT INSERTED.id
                VALUES (?, ?, ?, ?, ?, ?)
            """, (project_id, field_name, field_type, field_options, is_required, user_id))
            
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
                    field_options: Optional[str] = None, is_required: Optional[bool] = None,
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
            if is_required is not None:
                updates.append("is_required = ?")
                params.append(is_required)
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
        Получить значения кастомных полей для задачи
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        # Получаем project_id задачи
        cursor.execute("SELECT project_id FROM Task_Manager.tasks WHERE id = ?", (task_id,))
        result = cursor.fetchone()
        
        if not result:
            cursor.close()
            conn.close()
            raise ValueError("Задача не найдена")
        
        project_id = result[0]
        
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
                cf.id as field_id,
                cf.field_name,
                cf.field_type,
                cf.field_options,
                cf.is_required,
                COALESCE(cfv.value, '') as value,
                cfv.id as value_id
            FROM Task_Manager.custom_fields cf
            LEFT JOIN Task_Manager.custom_field_values cfv ON cf.id = cfv.field_id AND cfv.task_id = ?
            WHERE cf.project_id = ? AND cf.is_active = 1
            ORDER BY cf.order_index, cf.id
        """
        
        cursor.execute(query, (task_id, project_id))
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        
        return results
    
    @staticmethod
    def set_field_value(task_id: int, field_id: int, value: str, user_id: int) -> bool:
        """
        Установить значение кастомного поля для задачи
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Проверяем доступ к задаче
            cursor.execute("""
                SELECT t.project_id, pm.role
                FROM Task_Manager.tasks t
                INNER JOIN Task_Manager.project_members pm ON t.project_id = pm.project_id
                WHERE t.id = ? AND pm.user_id = ?
            """, (task_id, user_id))
            
            result = cursor.fetchone()
            if not result:
                raise PermissionError("Нет доступа к задаче")
            
            role = result[1]
            if role == 'viewer':
                raise PermissionError("Viewer не может редактировать поля")
            
            # Проверяем существование поля
            cursor.execute("""
                SELECT 1 FROM Task_Manager.custom_fields 
                WHERE id = ? AND is_active = 1
            """, (field_id,))
            
            if not cursor.fetchone():
                raise ValueError("Поле не найдено или неактивно")
            
            # Проверяем существует ли уже значение
            cursor.execute("""
                SELECT id FROM Task_Manager.custom_field_values
                WHERE task_id = ? AND field_id = ?
            """, (task_id, field_id))
            
            existing = cursor.fetchone()
            
            if existing:
                # Обновляем
                cursor.execute("""
                    UPDATE Task_Manager.custom_field_values
                    SET value = ?, updated_at = GETDATE()
                    WHERE id = ?
                """, (value, existing[0]))
            else:
                # Создаем
                cursor.execute("""
                    INSERT INTO Task_Manager.custom_field_values (task_id, field_id, value)
                    VALUES (?, ?, ?)
                """, (task_id, field_id, value))
            
            conn.commit()
            return True
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

