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
                status_group,
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
    def _flags_from_group(status_group: str):
        """Derive is_final from status_group. is_initial is user-controlled separately."""
        is_final = status_group in ('done', 'canceled')
        return is_final

    @staticmethod
    def create_status(project_id: int, user_id: int, name: str, color: str,
                     order_index: int, status_group: str = 'in_progress',
                     is_initial: bool = False, is_final: bool = False) -> int:
        """
        Создать новый статус. is_initial — явный флаг разрешения создания задач.
        """
        if not WorkflowService.check_admin_access(project_id, user_id):
            raise PermissionError("Только owner или admin могут управлять воркфлоу")

        derived_final = WorkflowService._flags_from_group(status_group)

        conn = get_connection()
        cursor = conn.cursor()

        try:
            cursor.execute("""
                INSERT INTO Task_Manager.workflow_statuses
                (project_id, name, color, order_index, is_initial, is_final, is_system, status_group)
                OUTPUT INSERTED.id
                VALUES (?, ?, ?, ?, ?, ?, 0, ?)
            """, (project_id, name, color, order_index, is_initial, derived_final, status_group))

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
                     status_group: Optional[str] = None,
                     is_initial: Optional[bool] = None, is_final: Optional[bool] = None) -> bool:
        """
        Обновить статус. Если передан status_group — is_initial/is_final выводятся автоматически.
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

            # Если меняется status_group — автоматически обновляем is_final
            if status_group is not None:
                derived_final = WorkflowService._flags_from_group(status_group)
                if is_final is None:
                    is_final = derived_final

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
            if status_group is not None:
                updates.append("status_group = ?")
                params.append(status_group)
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

            # Очищаем связанные права редактирования по статусу
            cursor.execute(
                "DELETE FROM Task_Manager.status_edit_permissions WHERE status_id = ?",
                (status_id,)
            )
            
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
                wt.created_at,
                wt.approval_mode,
                wt.approver_departments
            FROM Task_Manager.workflow_transitions wt
            INNER JOIN Task_Manager.workflow_statuses from_status ON wt.from_status_id = from_status.id
            INNER JOIN Task_Manager.workflow_statuses to_status ON wt.to_status_id = to_status.id
            WHERE wt.project_id = ?
        """
        
        try:
            cursor.execute(query, (project_id,))
        except Exception:
            # Fallback: query without new columns (before migration)
            query_fallback = """
                SELECT 
                    wt.id, wt.project_id, wt.from_status_id,
                    from_status.name as from_status_name,
                    from_status.color as from_status_color,
                    wt.to_status_id,
                    to_status.name as to_status_name,
                    to_status.color as to_status_color,
                    wt.name as transition_name,
                    wt.allowed_roles, wt.permission_type, wt.allowed_users,
                    wt.is_bidirectional, wt.requires_attachment,
                    wt.requires_approvals, wt.required_approvals_count,
                    wt.required_approvers, wt.auto_transition, wt.created_at,
                    NULL as approval_mode, NULL as approver_departments
                FROM Task_Manager.workflow_transitions wt
                INNER JOIN Task_Manager.workflow_statuses from_status ON wt.from_status_id = from_status.id
                INNER JOIN Task_Manager.workflow_statuses to_status ON wt.to_status_id = to_status.id
                WHERE wt.project_id = ?
            """
            cursor.execute(query_fallback, (project_id,))
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
                         required_approvers: Optional[str] = None, auto_transition: bool = False,
                         approval_mode: str = 'count',
                         approver_departments: Optional[str] = None,
                         required_fields: Optional[str] = None) -> int:
        """
        Создать переход между статусами
        """
        if not WorkflowService.check_admin_access(project_id, user_id):
            raise PermissionError("Только owner или admin могут управлять воркфлоу")
        
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Защита от дублирующихся переходов между одинаковой парой статусов
            cursor.execute("""
                SELECT id
                FROM Task_Manager.workflow_transitions
                WHERE project_id = ? AND from_status_id = ? AND to_status_id = ?
            """, (project_id, from_status_id, to_status_id))
            existing = cursor.fetchone()
            if existing:
                raise ValueError("transitionAlreadyExists")

            cursor.execute("""
                INSERT INTO Task_Manager.workflow_transitions
                (project_id, from_status_id, to_status_id, name, allowed_roles, permission_type,
                 allowed_users, is_bidirectional, requires_attachment, requires_approvals,
                 required_approvals_count, required_approvers, auto_transition,
                 approval_mode, approver_departments, required_fields)
                OUTPUT INSERTED.id
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (project_id, from_status_id, to_status_id, name, allowed_roles, permission_type,
                  allowed_users, is_bidirectional, requires_attachment, requires_approvals,
                  required_approvals_count, required_approvers, auto_transition,
                  approval_mode, approver_departments, required_fields))
            
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
                         auto_transition: Optional[bool] = None,
                         approval_mode: Optional[str] = None,
                         approver_departments: Optional[str] = None,
                         required_fields: Optional[str] = None) -> bool:
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
            if approval_mode is not None:
                updates.append("approval_mode = ?")
                params.append(approval_mode)
            if approver_departments is not None:
                updates.append("approver_departments = ?")
                params.append(approver_departments)
            if required_fields is not None:
                updates.append("required_fields = ?")
                params.append(required_fields)
            
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

    # ──────────────────────────────────────────────────────────────
    # Status-level edit permissions
    # ──────────────────────────────────────────────────────────────

    @staticmethod
    def set_creation_restriction_toggle(project_id: int, user_id: int, enabled: bool) -> bool:
        """Включить / выключить ограничение создания задач по флагу is_initial."""
        if not WorkflowService.check_admin_access(project_id, user_id):
            raise PermissionError("Только owner или admin могут управлять воркфлоу")
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "UPDATE Task_Manager.projects SET has_creation_restriction = ? WHERE id = ?",
                (1 if enabled else 0, project_id)
            )
            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def get_creation_restriction(project_id: int) -> bool:
        """Вернуть текущее состояние флага has_creation_restriction."""
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT has_creation_restriction FROM Task_Manager.projects WHERE id = ?",
                (project_id,)
            )
            row = cursor.fetchone()
            return bool(row[0]) if row else False
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def set_status_is_initial(project_id: int, user_id: int, status_id: int, is_initial: bool) -> bool:
        """Явно задать флаг is_initial для статуса (в т.ч. системного)."""
        if not WorkflowService.check_admin_access(project_id, user_id):
            raise PermissionError("Только owner или admin могут управлять воркфлоу")
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "UPDATE Task_Manager.workflow_statuses SET is_initial = ? WHERE id = ? AND project_id = ?",
                (1 if is_initial else 0, status_id, project_id)
            )
            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def set_status_permissions_toggle(project_id: int, user_id: int, enabled: bool) -> bool:
        """Включить / выключить кастомные права по статусам для проекта."""
        if not WorkflowService.check_admin_access(project_id, user_id):
            raise PermissionError("Только owner или admin могут управлять воркфлоу")
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "UPDATE Task_Manager.projects SET has_status_permissions = ? WHERE id = ?",
                (1 if enabled else 0, project_id)
            )
            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def get_status_permissions(project_id: int) -> dict:
        """Вернуть toggle и все записи status_edit_permissions для проекта."""
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT has_status_permissions FROM Task_Manager.projects WHERE id = ?",
                (project_id,)
            )
            row = cursor.fetchone()
            enabled = bool(row[0]) if row else False

            cursor.execute("""
                SELECT status_id, user_ids, department_ids
                FROM Task_Manager.status_edit_permissions
                WHERE project_id = ?
            """, (project_id,))
            permissions = [
                {'status_id': r[0], 'user_ids': r[1], 'department_ids': r[2]}
                for r in cursor.fetchall()
            ]
            return {'enabled': enabled, 'permissions': permissions}
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def save_status_permission(project_id: int, user_id: int,
                               status_id: int,
                               user_ids: Optional[str],
                               department_ids: Optional[str]) -> bool:
        """Сохранить (upsert) права редактирования для конкретного статуса."""
        if not WorkflowService.check_admin_access(project_id, user_id):
            raise PermissionError("Только owner или admin могут управлять воркфлоу")
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                IF EXISTS (
                    SELECT 1 FROM Task_Manager.status_edit_permissions
                    WHERE project_id = ? AND status_id = ?
                )
                    UPDATE Task_Manager.status_edit_permissions
                    SET user_ids = ?, department_ids = ?
                    WHERE project_id = ? AND status_id = ?
                ELSE
                    INSERT INTO Task_Manager.status_edit_permissions
                    (project_id, status_id, user_ids, department_ids)
                    VALUES (?, ?, ?, ?)
            """, (project_id, status_id,
                  user_ids, department_ids, project_id, status_id,
                  project_id, status_id, user_ids, department_ids))
            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def delete_status_permission(project_id: int, user_id: int, status_id: int) -> bool:
        """Удалить ограничения редактирования для статуса."""
        if not WorkflowService.check_admin_access(project_id, user_id):
            raise PermissionError("Только owner или admin могут управлять воркфлоу")
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                DELETE FROM Task_Manager.status_edit_permissions
                WHERE project_id = ? AND status_id = ?
            """, (project_id, status_id))
            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

