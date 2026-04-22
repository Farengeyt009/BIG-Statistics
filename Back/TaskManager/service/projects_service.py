"""
Сервис для работы с проектами и категориями
"""
from Back.database.db_connector import get_connection
from typing import List, Dict, Optional
import json
import time


class ProjectsService:
    _members_cache_ttl_sec = 30
    _members_cache: Dict[int, Dict] = {}

    @staticmethod
    def _get_cached_members(project_id: int) -> Optional[List[Dict]]:
        entry = ProjectsService._members_cache.get(project_id)
        if not entry:
            return None
        if time.time() - entry['ts'] > ProjectsService._members_cache_ttl_sec:
            ProjectsService._members_cache.pop(project_id, None)
            return None
        return entry['members']

    @staticmethod
    def _set_cached_members(project_id: int, members: List[Dict]) -> None:
        ProjectsService._members_cache[project_id] = {'ts': time.time(), 'members': members}

    @staticmethod
    def _invalidate_members_cache(project_id: int) -> None:
        ProjectsService._members_cache.pop(project_id, None)
    
    @staticmethod
    def get_user_projects(user_id: int) -> List[Dict]:
        """
        Получить все проекты пользователя (где он owner или member)
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        query = """
            SELECT DISTINCT
                p.id,
                p.name,
                p.description,
                p.category_id,
                pc.name as category_name,
                pc.color as category_color,
                p.owner_id,
                u.Username as owner_name,
                pm.role as user_role,
                pm.is_favorite,
                p.has_workflow_permissions,
                p.created_at,
                p.updated_at,
                (SELECT COUNT(*) FROM Task_Manager.tasks WHERE project_id = p.id) as task_count,
                (SELECT COUNT(*) FROM Task_Manager.project_members WHERE project_id = p.id) as member_count
            FROM Task_Manager.projects p
            LEFT JOIN Task_Manager.project_categories pc ON p.category_id = pc.id
            LEFT JOIN Users.users u ON p.owner_id = u.UserID
            INNER JOIN Task_Manager.project_members pm ON p.id = pm.project_id
            WHERE pm.user_id = ?
            ORDER BY p.updated_at DESC
        """
        
        cursor.execute(query, (user_id,))
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]

        # Получаем участников всех проектов одним запросом (без N+1)
        if results:
            project_ids = [project['id'] for project in results]
            placeholders = ','.join(['?'] * len(project_ids))
            cursor.execute(f"""
                SELECT
                    pm.project_id,
                    pm.user_id,
                    u.Username as username,
                    u.FullName as full_name
                FROM Task_Manager.project_members pm
                INNER JOIN Users.users u ON pm.user_id = u.UserID
                WHERE pm.project_id IN ({placeholders})
                ORDER BY
                    pm.project_id,
                    CASE pm.role
                        WHEN 'owner' THEN 1
                        WHEN 'admin' THEN 2
                        WHEN 'member' THEN 3
                        WHEN 'viewer' THEN 4
                    END
            """, project_ids)

            members_by_project = {project_id: [] for project_id in project_ids}
            for project_id, member_user_id, member_username, member_full_name in cursor.fetchall():
                members_by_project[project_id].append({
                    'user_id': member_user_id,
                    'username': member_username,
                    'full_name': member_full_name
                })

            for project in results:
                project['members'] = members_by_project.get(project['id'], [])
        
        cursor.close()
        conn.close()
        
        return results

    @staticmethod
    def set_project_favorite(project_id: int, user_id: int, is_favorite: bool) -> bool:
        """
        Установить/снять флаг избранного проекта для конкретного пользователя.
        """
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                UPDATE Task_Manager.project_members
                SET is_favorite = ?
                WHERE project_id = ? AND user_id = ?
            """, (1 if is_favorite else 0, project_id, user_id))

            if cursor.rowcount == 0:
                raise PermissionError("Нет доступа к проекту")

            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
    
    @staticmethod
    def get_project_by_id(project_id: int, user_id: int) -> Optional[Dict]:
        """
        Получить проект по ID (с проверкой прав доступа)
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        query = """
            SELECT 
                p.id,
                p.name,
                p.description,
                p.category_id,
                pc.name as category_name,
                p.owner_id,
                u.Username as owner_name,
                pm.role as user_role,
                p.has_workflow_permissions,
                p.default_assignee_id,
                p.default_subtask_assignee_id,
                p.created_at,
                p.updated_at
            FROM Task_Manager.projects p
            LEFT JOIN Task_Manager.project_categories pc ON p.category_id = pc.id
            LEFT JOIN Users.users u ON p.owner_id = u.UserID
            INNER JOIN Task_Manager.project_members pm ON p.id = pm.project_id
            WHERE p.id = ? AND pm.user_id = ?
        """
        
        cursor.execute(query, (project_id, user_id))
        columns = [column[0] for column in cursor.description]
        row = cursor.fetchone()
        
        result = dict(zip(columns, row)) if row else None
        
        cursor.close()
        conn.close()
        
        return result
    
    @staticmethod
    def create_project(name: str, description: str, category_id: Optional[int], owner_id: int, 
                      has_workflow_permissions: bool = False) -> int:
        """
        Создать новый проект
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Создаем проект
            cursor.execute("""
                INSERT INTO Task_Manager.projects (name, description, category_id, owner_id, has_workflow_permissions)
                OUTPUT INSERTED.id
                VALUES (?, ?, ?, ?, ?)
            """, (name, description, category_id, owner_id, has_workflow_permissions))
            
            project_id = cursor.fetchone()[0]
            
            # Добавляем владельца как участника с ролью owner
            cursor.execute("""
                INSERT INTO Task_Manager.project_members (project_id, user_id, role, added_by)
                VALUES (?, ?, 'owner', ?)
            """, (project_id, owner_id, owner_id))
            
            # Создаем дефолтные статусы
            default_statuses = [
                ('Новая',    '#94a3b8', 0, True,  False, 'new',         True),
                ('В работе', '#3b82f6', 1, False, False, 'in_progress', True),
                ('Завершена','#10b981', 2, False, True,  'done',        True),
                ('Отменена', '#ef4444', 3, False, True,  'canceled',    True),
            ]

            for status_name, color, order_idx, is_initial, is_final, status_group, is_system in default_statuses:
                cursor.execute("""
                    INSERT INTO Task_Manager.workflow_statuses
                    (project_id, name, color, order_index, is_initial, is_final, status_group, is_system)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (project_id, status_name, color, order_idx, is_initial, is_final, status_group, is_system))
            
            conn.commit()
            return project_id
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
    
    @staticmethod
    def update_project(project_id: int, user_id: int, name: Optional[str] = None, 
                      description: Optional[str] = None, category_id: Optional[int] = None,
                      has_workflow_permissions: Optional[bool] = None,
                      default_assignee_id: Optional[int] = None,
                      default_subtask_assignee_id: Optional[int] = None) -> bool:
        """
        Обновить проект (только owner может редактировать)
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Проверяем, что пользователь - owner
            cursor.execute("""
                SELECT role FROM Task_Manager.project_members 
                WHERE project_id = ? AND user_id = ?
            """, (project_id, user_id))
            
            row = cursor.fetchone()
            if not row or row[0] != 'owner':
                raise PermissionError("Только владелец проекта может редактировать его")
            
            # Формируем UPDATE запрос
            updates = []
            params = []
            
            if name is not None:
                updates.append("name = ?")
                params.append(name)
            if description is not None:
                updates.append("description = ?")
                params.append(description)
            if category_id is not None:
                updates.append("category_id = ?")
                params.append(category_id)
            if has_workflow_permissions is not None:
                updates.append("has_workflow_permissions = ?")
                params.append(has_workflow_permissions)
            if default_assignee_id is not None:
                updates.append("default_assignee_id = ?")
                params.append(default_assignee_id)
            if default_subtask_assignee_id is not None:
                updates.append("default_subtask_assignee_id = ?")
                params.append(default_subtask_assignee_id)

            if updates:
                updates.append("updated_at = GETUTCDATE()")
                params.append(project_id)
                
                query = f"UPDATE Task_Manager.projects SET {', '.join(updates)} WHERE id = ?"
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
    def transfer_ownership(project_id: int, current_owner_id: int, new_owner_id: int) -> bool:
        """
        Передать права владельца другому пользователю
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Проверяем что текущий пользователь - owner
            cursor.execute("""
                SELECT owner_id FROM Task_Manager.projects WHERE id = ?
            """, (project_id,))
            
            result = cursor.fetchone()
            if not result or result[0] != current_owner_id:
                raise PermissionError("Только владелец может передавать права")
            
            # Проверяем что новый owner - участник проекта
            cursor.execute("""
                SELECT role FROM Task_Manager.project_members 
                WHERE project_id = ? AND user_id = ?
            """, (project_id, new_owner_id))
            
            member = cursor.fetchone()
            if not member:
                raise ValueError("Новый владелец должен быть участником проекта")
            
            # Обновляем owner в проекте
            cursor.execute("""
                UPDATE Task_Manager.projects
                SET owner_id = ?
                WHERE id = ?
            """, (new_owner_id, project_id))
            
            # Обновляем роли участников
            cursor.execute("""
                UPDATE Task_Manager.project_members
                SET role = 'admin'
                WHERE project_id = ? AND user_id = ?
            """, (project_id, current_owner_id))
            
            cursor.execute("""
                UPDATE Task_Manager.project_members
                SET role = 'owner'
                WHERE project_id = ? AND user_id = ?
            """, (project_id, new_owner_id))
            
            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
    
    @staticmethod
    def delete_project(project_id: int, user_id: int) -> bool:
        """
        Удалить проект (только owner)
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Проверяем, что пользователь - owner
            cursor.execute("""
                SELECT role FROM Task_Manager.project_members 
                WHERE project_id = ? AND user_id = ?
            """, (project_id, user_id))
            
            row = cursor.fetchone()
            if not row or row[0] != 'owner':
                raise PermissionError("Только владелец проекта может удалить его")
            
            cursor.execute("DELETE FROM Task_Manager.projects WHERE id = ?", (project_id,))
            conn.commit()
            
            return True
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
    
    # ============= КАТЕГОРИИ =============
    
    @staticmethod
    def get_categories(user_id: int) -> List[Dict]:
        """
        Получить все категории (созданные пользователем или общие)
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        query = """
            SELECT 
                id,
                name,
                description,
                icon,
                color,
                created_by,
                created_at,
                (SELECT COUNT(*) FROM Task_Manager.projects WHERE category_id = pc.id) as project_count
            FROM Task_Manager.project_categories pc
            WHERE created_by = ? OR created_by IS NULL
            ORDER BY name
        """
        
        cursor.execute(query, (user_id,))
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        
        return results
    
    @staticmethod
    def create_category(name: str, description: str, icon: str, color: str, user_id: int) -> int:
        """
        Создать новую категорию
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO Task_Manager.project_categories (name, description, icon, color, created_by)
                OUTPUT INSERTED.id
                VALUES (?, ?, ?, ?, ?)
            """, (name, description, icon, color, user_id))
            
            category_id = cursor.fetchone()[0]
            conn.commit()
            
            return category_id
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
    
    # ============= УЧАСТНИКИ =============
    
    @staticmethod
    def get_project_members(project_id: int, user_id: int) -> List[Dict]:
        """
        Получить список участников проекта
        """
        cached = ProjectsService._get_cached_members(project_id)
        if cached is not None:
            return cached

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
                pm.id,
                pm.user_id,
                u.Username as username,
                u.FullName as full_name,
                d.Name as department,
                pm.role,
                pm.added_at,
                added_by_user.Username as added_by_name
            FROM Task_Manager.project_members pm
            INNER JOIN Users.users u ON pm.user_id = u.UserID
            LEFT JOIN Users.Departments d ON u.department_id = d.DepartmentID
            LEFT JOIN Users.users added_by_user ON pm.added_by = added_by_user.UserID
            WHERE pm.project_id = ?
            ORDER BY 
                CASE pm.role
                    WHEN 'owner' THEN 1
                    WHEN 'admin' THEN 2
                    WHEN 'member' THEN 3
                    WHEN 'viewer' THEN 4
                END,
                u.Username
        """
        
        cursor.execute(query, (project_id,))
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        ProjectsService._set_cached_members(project_id, results)
        return results
    
    @staticmethod
    def add_project_member(project_id: int, user_id: int, new_member_id: int, role: str) -> bool:
        """
        Добавить участника в проект (только owner или admin)
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Проверяем права
            cursor.execute("""
                SELECT role FROM Task_Manager.project_members 
                WHERE project_id = ? AND user_id = ?
            """, (project_id, user_id))
            
            row = cursor.fetchone()
            if not row or row[0] not in ('owner', 'admin'):
                raise PermissionError("Только owner или admin могут добавлять участников")
            
            # Добавляем участника
            cursor.execute("""
                INSERT INTO Task_Manager.project_members (project_id, user_id, role, added_by)
                VALUES (?, ?, ?, ?)
            """, (project_id, new_member_id, role, user_id))
            
            conn.commit()
            ProjectsService._invalidate_members_cache(project_id)
            return True
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
    
    @staticmethod
    def update_member_role(project_id: int, user_id: int, member_id: int, new_role: str) -> bool:
        """
        Изменить роль участника (только owner)
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Проверяем, что пользователь - owner
            cursor.execute("""
                SELECT role FROM Task_Manager.project_members 
                WHERE project_id = ? AND user_id = ?
            """, (project_id, user_id))
            
            row = cursor.fetchone()
            if not row or row[0] != 'owner':
                raise PermissionError("Только owner может изменять роли")
            
            # Нельзя изменить роль owner
            cursor.execute("""
                SELECT role FROM Task_Manager.project_members 
                WHERE project_id = ? AND user_id = ?
            """, (project_id, member_id))
            
            current_role = cursor.fetchone()
            if current_role and current_role[0] == 'owner':
                raise PermissionError("Нельзя изменить роль владельца")
            
            cursor.execute("""
                UPDATE Task_Manager.project_members 
                SET role = ?
                WHERE project_id = ? AND user_id = ?
            """, (new_role, project_id, member_id))
            
            conn.commit()
            ProjectsService._invalidate_members_cache(project_id)
            return True
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
    
    @staticmethod
    def remove_project_member(project_id: int, user_id: int, member_id: int) -> bool:
        """
        Удалить участника из проекта (только owner или admin)
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Проверяем права
            cursor.execute("""
                SELECT role FROM Task_Manager.project_members 
                WHERE project_id = ? AND user_id = ?
            """, (project_id, user_id))
            
            row = cursor.fetchone()
            if not row or row[0] not in ('owner', 'admin'):
                raise PermissionError("Только owner или admin могут удалять участников")
            
            # Нельзя удалить owner
            cursor.execute("""
                SELECT role FROM Task_Manager.project_members 
                WHERE project_id = ? AND user_id = ?
            """, (project_id, member_id))
            
            member_role = cursor.fetchone()
            if member_role and member_role[0] == 'owner':
                raise PermissionError("Нельзя удалить владельца проекта")
            
            cursor.execute("""
                DELETE FROM Task_Manager.project_members 
                WHERE project_id = ? AND user_id = ?
            """, (project_id, member_id))
            
            conn.commit()
            ProjectsService._invalidate_members_cache(project_id)
            return True
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

