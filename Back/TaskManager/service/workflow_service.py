"""
Сервис для работы с воркфлоу (статусы и переходы)
"""
from Back.database.db_connector import get_connection
from typing import List, Dict, Optional
import json


class WorkflowService:
    
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
    
    # ============= СТАТУСЫ =============
    
    @staticmethod
    def get_project_statuses(project_id: int, user_id: int) -> List[Dict]:
        """
        Получить все статусы проекта
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        # Проверяем доступ к проекту
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
                name,
                color,
                order_index,
                is_initial,
                is_final,
                is_system,
                created_at,
                (SELECT COUNT(*) FROM Task_Manager.tasks WHERE status_id = ws.id) as task_count
            FROM Task_Manager.workflow_statuses ws
            WHERE project_id = ?
            ORDER BY order_index
        """
        
        cursor.execute(query, (project_id,))
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        
        return results
    
    @staticmethod
    def create_status(project_id: int, user_id: int, name: str, color: str, 
                     order_index: int, is_initial: bool = False, is_final: bool = False) -> int:
        """
        Создать новый статус
        """
        if not WorkflowService.check_admin_access(project_id, user_id):
            raise PermissionError("Только owner или admin могут управлять воркфлоу")
        
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Если это начальный статус, убираем флаг у других
            if is_initial:
                cursor.execute("""
                    UPDATE Task_Manager.workflow_statuses SET is_initial = 0 WHERE project_id = ?
                """, (project_id,))
            
            cursor.execute("""
                INSERT INTO Task_Manager.workflow_statuses 
                (project_id, name, color, order_index, is_initial, is_final)
                OUTPUT INSERTED.id
                VALUES (?, ?, ?, ?, ?, ?)
            """, (project_id, name, color, order_index, is_initial, is_final))
            
            status_id = cursor.fetchone()[0]
            conn.commit()
            
            return status_id
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
    
    @staticmethod
    def update_status(status_id: int, user_id: int, name: Optional[str] = None,
                     color: Optional[str] = None, order_index: Optional[int] = None,
                     is_initial: Optional[bool] = None, is_final: Optional[bool] = None) -> bool:
        """
        Обновить статус
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Получаем project_id
            cursor.execute("SELECT project_id FROM Task_Manager.workflow_statuses WHERE id = ?", (status_id,))
            result = cursor.fetchone()
            
            if not result:
                raise ValueError("Статус не найден")
            
            project_id = result[0]
            
            if not WorkflowService.check_admin_access(project_id, user_id):
                raise PermissionError("Только owner или admin могут управлять воркфлоу")
            
            # Если меняем на начальный, убираем у других
            if is_initial:
                cursor.execute("""
                    UPDATE Task_Manager.workflow_statuses SET is_initial = 0 WHERE project_id = ?
                """, (project_id,))
            
            # Формируем UPDATE
            updates = []
            params = []
            
            if name is not None:
                updates.append("name = ?")
                params.append(name)
            if color is not None:
                updates.append("color = ?")
                params.append(color)
            if order_index is not None:
                updates.append("order_index = ?")
                params.append(order_index)
            if is_initial is not None:
                updates.append("is_initial = ?")
                params.append(is_initial)
            if is_final is not None:
                updates.append("is_final = ?")
                params.append(is_final)
            
            if updates:
                params.append(status_id)
                query = f"UPDATE Task_Manager.workflow_statuses SET {', '.join(updates)} WHERE id = ?"
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
    def delete_status(status_id: int, user_id: int) -> bool:
        """
        Удалить статус (если нет задач)
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Получаем информацию о статусе
            cursor.execute("""
                SELECT project_id, is_system, name 
                FROM Task_Manager.workflow_statuses 
                WHERE id = ?
            """, (status_id,))
            result = cursor.fetchone()
            
            if not result:
                raise ValueError("Статус не найден")
            
            project_id, is_system, status_name = result
            
            # Проверка 1: Системные статусы нельзя удалять
            if is_system:
                raise PermissionError(f"Нельзя удалить системный статус '{status_name}'")
            
            if not WorkflowService.check_admin_access(project_id, user_id):
                raise PermissionError("Только owner или admin могут управлять воркфлоу")
            
            # Проверка 2: Есть ли задачи с этим статусом
            cursor.execute("SELECT COUNT(*) FROM Task_Manager.tasks WHERE status_id = ?", (status_id,))
            task_count = cursor.fetchone()[0]
            
            if task_count > 0:
                raise ValueError(f"Нельзя удалить статус '{status_name}' - в нём {task_count} задач. Сначала переместите задачи в другой статус.")
            
            cursor.execute("DELETE FROM Task_Manager.workflow_statuses WHERE id = ?", (status_id,))
            conn.commit()
            
            return True
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
    
    # ============= ПЕРЕХОДЫ =============
    
    @staticmethod
    def get_project_transitions(project_id: int, user_id: int) -> List[Dict]:
        """
        Получить все переходы воркфлоу проекта
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
                wt.id,
                wt.project_id,
                wt.from_status_id,
                from_status.name as from_status_name,
                from_status.color as from_status_color,
                wt.to_status_id,
                to_status.name as to_status_name,
                to_status.color as to_status_color,
                wt.name as transition_name,
                wt.allowed_roles,
                wt.permission_type,
                wt.allowed_users,
                wt.is_bidirectional,
                wt.requires_attachment,
                wt.requires_approvals,
                wt.required_approvals_count,
                wt.required_approvers,
                wt.auto_transition,
                wt.created_at
            FROM Task_Manager.workflow_transitions wt
            INNER JOIN Task_Manager.workflow_statuses from_status ON wt.from_status_id = from_status.id
            INNER JOIN Task_Manager.workflow_statuses to_status ON wt.to_status_id = to_status.id
            WHERE wt.project_id = ?
        """
        
        cursor.execute(query, (project_id,))
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        
        return results
    
    @staticmethod
    def create_transition(project_id: int, user_id: int, from_status_id: int,
                         to_status_id: int, name: str, allowed_roles: Optional[str] = None,
                         permission_type: str = 'roles', allowed_users: Optional[str] = None,
                         is_bidirectional: bool = False, requires_attachment: bool = False,
                         requires_approvals: bool = False, required_approvals_count: int = 0,
                         required_approvers: Optional[str] = None, auto_transition: bool = False) -> int:
        """
        Создать переход между статусами
        """
        if not WorkflowService.check_admin_access(project_id, user_id):
            raise PermissionError("Только owner или admin могут управлять воркфлоу")
        
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO Task_Manager.workflow_transitions 
                (project_id, from_status_id, to_status_id, name, allowed_roles, permission_type, allowed_users, is_bidirectional, requires_attachment, requires_approvals, required_approvals_count, required_approvers, auto_transition)
                OUTPUT INSERTED.id
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (project_id, from_status_id, to_status_id, name, allowed_roles, permission_type, allowed_users, is_bidirectional, requires_attachment, requires_approvals, required_approvals_count, required_approvers, auto_transition))
            
            transition_id = cursor.fetchone()[0]
            conn.commit()
            
            return transition_id
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
    
    @staticmethod
    def update_transition(transition_id: int, user_id: int, name: Optional[str] = None,
                         allowed_roles: Optional[str] = None, permission_type: Optional[str] = None,
                         allowed_users: Optional[str] = None, is_bidirectional: Optional[bool] = None,
                         requires_attachment: Optional[bool] = None, requires_approvals: Optional[bool] = None,
                         required_approvals_count: Optional[int] = None, required_approvers: Optional[str] = None,
                         auto_transition: Optional[bool] = None) -> bool:
        """
        Обновить переход
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Получаем project_id
            cursor.execute("SELECT project_id FROM Task_Manager.workflow_transitions WHERE id = ?", (transition_id,))
            result = cursor.fetchone()
            
            if not result:
                raise ValueError("Переход не найден")
            
            project_id = result[0]
            
            if not WorkflowService.check_admin_access(project_id, user_id):
                raise PermissionError("Только owner или admin могут управлять воркфлоу")
            
            updates = []
            params = []
            
            if name is not None:
                updates.append("name = ?")
                params.append(name)
            if allowed_roles is not None:
                updates.append("allowed_roles = ?")
                params.append(allowed_roles)
            if permission_type is not None:
                updates.append("permission_type = ?")
                params.append(permission_type)
            if allowed_users is not None:
                updates.append("allowed_users = ?")
                params.append(allowed_users)
            if is_bidirectional is not None:
                updates.append("is_bidirectional = ?")
                params.append(is_bidirectional)
            if requires_attachment is not None:
                updates.append("requires_attachment = ?")
                params.append(requires_attachment)
            if requires_approvals is not None:
                updates.append("requires_approvals = ?")
                params.append(requires_approvals)
            if required_approvals_count is not None:
                updates.append("required_approvals_count = ?")
                params.append(required_approvals_count)
            if required_approvers is not None:
                updates.append("required_approvers = ?")
                params.append(required_approvers)
            if auto_transition is not None:
                updates.append("auto_transition = ?")
                params.append(auto_transition)
            
            if updates:
                params.append(transition_id)
                query = f"UPDATE Task_Manager.workflow_transitions SET {', '.join(updates)} WHERE id = ?"
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
    def delete_transition(transition_id: int, user_id: int) -> bool:
        """
        Удалить переход
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Получаем project_id
            cursor.execute("SELECT project_id FROM Task_Manager.workflow_transitions WHERE id = ?", (transition_id,))
            result = cursor.fetchone()
            
            if not result:
                raise ValueError("Переход не найден")
            
            project_id = result[0]
            
            if not WorkflowService.check_admin_access(project_id, user_id):
                raise PermissionError("Только owner или admin могут управлять воркфлоу")
            
            cursor.execute("DELETE FROM Task_Manager.workflow_transitions WHERE id = ?", (transition_id,))
            conn.commit()
            
            return True
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

