"""
Сервис для работы с задачами
"""
from Back.database.db_connector import get_connection
from typing import List, Dict, Optional
from datetime import datetime


class TasksService:
    
    @staticmethod
    def check_project_access(project_id: int, user_id: int) -> Optional[str]:
        """
        Проверить доступ к проекту и вернуть роль пользователя
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT role FROM Task_Manager.project_members
            WHERE project_id = ? AND user_id = ?
        """, (project_id, user_id))
        
        result = cursor.fetchone()
        role = result[0] if result else None
        
        cursor.close()
        conn.close()
        
        return role
    
    @staticmethod
    def get_project_tasks(project_id: int, user_id: int, parent_task_id: Optional[int] = None) -> List[Dict]:
        """
        Получить задачи проекта (основные или подзадачи)
        """
        role = TasksService.check_project_access(project_id, user_id)
        if not role:
            raise PermissionError("noProjectAccess")
        
        conn = get_connection()
        cursor = conn.cursor()
        
        query = """
            SELECT 
                t.id,
                t.project_id,
                t.parent_task_id,
                t.title,
                t.description,
                t.status_id,
                ws.name as status_name,
                ws.color as status_color,
                t.assignee_id,
                assignee.Username as assignee_name,
                assignee.FullName as assignee_full_name,
                t.creator_id,
                creator.Username as creator_name,
                t.priority,
                t.due_date,
                t.completed_at,
                t.order_index,
                t.created_at,
                t.updated_at,
                (SELECT COUNT(*) FROM Task_Manager.tasks WHERE parent_task_id = t.id) as subtask_count,
                (SELECT COUNT(*) FROM Task_Manager.task_comments WHERE task_id = t.id) as comment_count,
                (SELECT COUNT(*) FROM Task_Manager.task_attachments WHERE task_id = t.id) as attachment_count
            FROM Task_Manager.tasks t
            LEFT JOIN Task_Manager.workflow_statuses ws ON t.status_id = ws.id
            LEFT JOIN Users.users assignee ON t.assignee_id = assignee.UserID
            LEFT JOIN Users.users creator ON t.creator_id = creator.UserID
            WHERE t.project_id = ? AND """ + (
                "t.parent_task_id IS NULL" if parent_task_id is None else "t.parent_task_id = ?"
            ) + """
            ORDER BY t.order_index, t.created_at DESC
        """
        
        params = (project_id, parent_task_id) if parent_task_id is not None else (project_id,)
        cursor.execute(query, params)
        
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        # Получаем теги и дополнительные поля для каждой задачи
        for task in results:
            # Теги
            cursor.execute("""
                SELECT t.id, t.name, t.color
                FROM Task_Manager.tags t
                INNER JOIN Task_Manager.task_tags tt ON t.id = tt.tag_id
                WHERE tt.task_id = ?
            """, (task['id'],))
            
            tag_columns = [column[0] for column in cursor.description]
            task['tags'] = [dict(zip(tag_columns, row)) for row in cursor.fetchall()]
            
            # Дополнительные поля
            cursor.execute("""
                SELECT 
                    cf.id as field_id,
                    cf.field_name,
                    cf.field_type,
                    COALESCE(cfv.value, '') as value
                FROM Task_Manager.custom_fields cf
                LEFT JOIN Task_Manager.custom_field_values cfv ON cf.id = cfv.field_id AND cfv.task_id = ?
                WHERE cf.project_id = ? AND cf.is_active = 1
                ORDER BY cf.order_index, cf.id
            """, (task['id'], project_id))
            
            field_columns = [column[0] for column in cursor.description]
            task['custom_fields'] = [dict(zip(field_columns, row)) for row in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        
        return results
    
    @staticmethod
    def get_task_by_id(task_id: int, user_id: int) -> Optional[Dict]:
        """
        Получить задачу по ID
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        query = """
            SELECT 
                t.id,
                t.project_id,
                t.parent_task_id,
                t.title,
                t.description,
                t.status_id,
                ws.name as status_name,
                ws.color as status_color,
                t.assignee_id,
                assignee.Username as assignee_name,
                assignee.FullName as assignee_full_name,
                t.creator_id,
                creator.Username as creator_name,
                t.priority,
                t.due_date,
                t.completed_at,
                t.order_index,
                t.created_at,
                t.updated_at
            FROM Task_Manager.tasks t
            LEFT JOIN Task_Manager.workflow_statuses ws ON t.status_id = ws.id
            LEFT JOIN Users.users assignee ON t.assignee_id = assignee.UserID
            LEFT JOIN Users.users creator ON t.creator_id = creator.UserID
            WHERE t.id = ?
        """
        
        cursor.execute(query, (task_id,))
        columns = [column[0] for column in cursor.description]
        row = cursor.fetchone()
        
        if not row:
            cursor.close()
            conn.close()
            return None
        
        task = dict(zip(columns, row))
        
        # Проверяем доступ
        role = TasksService.check_project_access(task['project_id'], user_id)
        if not role:
            cursor.close()
            conn.close()
            raise PermissionError("noProjectAccess")
        
        # Получаем теги
        cursor.execute("""
            SELECT t.id, t.name, t.color
            FROM Task_Manager.tags t
            INNER JOIN Task_Manager.task_tags tt ON t.id = tt.tag_id
            WHERE tt.task_id = ?
        """, (task_id,))
        
        tag_columns = [column[0] for column in cursor.description]
        task['tags'] = [dict(zip(tag_columns, row)) for row in cursor.fetchall()]
        
        # Получаем дополнительные поля
        cursor.execute("""
            SELECT 
                cf.id as field_id,
                cf.field_name,
                cf.field_type,
                COALESCE(cfv.value, '') as value
            FROM Task_Manager.custom_fields cf
            LEFT JOIN Task_Manager.custom_field_values cfv ON cf.id = cfv.field_id AND cfv.task_id = ?
            WHERE cf.project_id = ? AND cf.is_active = 1
            ORDER BY cf.order_index, cf.id
        """, (task_id, task['project_id']))
        
        field_columns = [column[0] for column in cursor.description]
        task['custom_fields'] = [dict(zip(field_columns, row)) for row in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        
        return task
    
    @staticmethod
    def create_task(project_id: int, user_id: int, title: str, description: Optional[str],
                   status_id: Optional[int], assignee_id: Optional[int], priority: str = 'medium',
                   due_date: Optional[str] = None, parent_task_id: Optional[int] = None,
                   tag_ids: Optional[List[int]] = None) -> int:
        """
        Создать новую задачу
        """
        role = TasksService.check_project_access(project_id, user_id)
        if not role:
            raise PermissionError("noProjectAccess")
        
        if role == 'viewer':
            raise PermissionError("viewerCannotCreate")
        
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Если статус не указан, берем начальный статус проекта
            if status_id is None:
                cursor.execute("""
                    SELECT id FROM Task_Manager.workflow_statuses
                    WHERE project_id = ? AND is_initial = 1
                """, (project_id,))
                result = cursor.fetchone()
                status_id = result[0] if result else None
            
            if status_id is None:
                raise ValueError("noInitialStatus")
            
            # Если исполнитель не указан, берем из настроек проекта
            if assignee_id is None:
                cursor.execute("""
                    SELECT default_assignee_id, default_subtask_assignee_id 
                    FROM Task_Manager.projects 
                    WHERE id = ?
                """, (project_id,))
                defaults = cursor.fetchone()
                if defaults:
                    # Для подзадачи берем default_subtask_assignee_id, для задачи - default_assignee_id
                    if parent_task_id is not None:
                        assignee_id = defaults[1]  # default_subtask_assignee_id
                    else:
                        assignee_id = defaults[0]  # default_assignee_id
            
            # Создаем задачу
            cursor.execute("""
                INSERT INTO Task_Manager.tasks 
                (project_id, parent_task_id, title, description, status_id, 
                 assignee_id, creator_id, priority, due_date)
                OUTPUT INSERTED.id
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (project_id, parent_task_id, title, description, status_id,
                  assignee_id, user_id, priority, due_date))
            
            task_id = cursor.fetchone()[0]
            
            # Добавляем теги
            if tag_ids:
                for tag_id in tag_ids:
                    cursor.execute("""
                        INSERT INTO Task_Manager.task_tags (task_id, tag_id)
                        VALUES (?, ?)
                    """, (task_id, tag_id))
            
            # Записываем в историю
            cursor.execute("""
                INSERT INTO Task_Manager.task_history (task_id, user_id, action_type, field_changed, new_value)
                VALUES (?, ?, 'created', 'status', ?)
            """, (task_id, user_id, str(status_id)))
            
            conn.commit()
            return task_id
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
    
    @staticmethod
    def update_task(task_id: int, user_id: int, title: Optional[str] = None,
                   description: Optional[str] = None, status_id: Optional[int] = None,
                   assignee_id: Optional[int] = None, priority: Optional[str] = None,
                   due_date: Optional[str] = None, tag_ids: Optional[List[int]] = None) -> bool:
        """
        Обновить задачу
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Получаем текущую задачу
            cursor.execute("SELECT project_id, status_id FROM Task_Manager.tasks WHERE id = ?", (task_id,))
            result = cursor.fetchone()
            
            if not result:
                raise ValueError("taskNotFound")
            
            project_id, old_status_id = result
            
            # Проверяем доступ
            role = TasksService.check_project_access(project_id, user_id)
            if not role:
                raise PermissionError("noProjectAccess")
            
            if role == 'viewer':
                raise PermissionError("viewerCannotEdit")
            
            # Формируем UPDATE
            updates = []
            params = []
            history_records = []
            
            if title is not None:
                updates.append("title = ?")
                params.append(title)
            
            if description is not None:
                updates.append("description = ?")
                params.append(description)
            
            if status_id is not None and status_id != old_status_id:
                # Проверяем права на переход, если они настроены
                cursor.execute("""
                    SELECT has_workflow_permissions FROM Task_Manager.projects WHERE id = ?
                """, (project_id,))
                
                has_permissions = cursor.fetchone()[0]
                
                if has_permissions:
                    # Проверяем прямой переход или обратный (двунаправленный)
                    cursor.execute("""
                        SELECT permission_type, allowed_roles, allowed_users, is_bidirectional, requires_attachment
                        FROM Task_Manager.workflow_transitions
                        WHERE project_id = ? AND (
                            (from_status_id = ? AND to_status_id = ?) OR
                            (from_status_id = ? AND to_status_id = ? AND is_bidirectional = 1)
                        )
                    """, (project_id, old_status_id, status_id, status_id, old_status_id))
                    
                    transition = cursor.fetchone()
                    if transition:
                        permission_type, allowed_roles, allowed_users, is_bidirectional, requires_attachment = transition
                        
                        # Проверяем права в зависимости от типа
                        if permission_type == 'any':
                            # Любой участник может
                            pass
                        elif permission_type == 'roles':
                            # Проверка по ролям
                            if allowed_roles:
                                import json
                                roles_list = json.loads(allowed_roles) if isinstance(allowed_roles, str) else allowed_roles
                                if role not in roles_list:
                                    raise PermissionError(f"insufficientRole:{','.join(roles_list)}")
                        elif permission_type == 'users':
                            # Проверка по конкретным пользователям
                            if allowed_users:
                                import json
                                users_list = json.loads(allowed_users) if isinstance(allowed_users, str) else allowed_users
                                if user_id not in users_list:
                                    raise PermissionError("insufficientUser")
                        
                        # Проверка условий перехода
                        if requires_attachment:
                            # Проверяем наличие вложений
                            cursor.execute("""
                                SELECT COUNT(*) FROM Task_Manager.task_attachments WHERE task_id = ?
                            """, (task_id,))
                            attachment_count = cursor.fetchone()[0]
                            if attachment_count == 0:
                                raise PermissionError("uploadFileRequired")
                        
                        # Проверка согласований (получаем из transition)
                        cursor.execute("""
                            SELECT requires_approvals, required_approvals_count, required_approvers
                            FROM Task_Manager.workflow_transitions
                            WHERE project_id = ? AND from_status_id = ? AND to_status_id = ?
                        """, (project_id, old_status_id, status_id))
                        
                        approval_req = cursor.fetchone()
                        if approval_req:
                            req_approvals, req_count, req_approvers = approval_req
                            
                            if req_approvals and req_count > 0:
                                # Получаем текущие согласования
                                cursor.execute("""
                                    SELECT user_id FROM Task_Manager.task_approvals WHERE task_id = ?
                                """, (task_id,))
                                approved_users = [row[0] for row in cursor.fetchall()]
                                
                                if req_approvers:
                                    # Есть список разрешенных согласователей
                                    import json
                                    required_users = json.loads(req_approvers) if isinstance(req_approvers, str) else req_approvers
                                    
                                    # Считаем сколько согласований от разрешенных пользователей
                                    approved_from_pool = [u for u in approved_users if u in required_users]
                                    
                                    if len(approved_from_pool) < req_count:
                                        raise PermissionError(f"insufficientApprovals:{req_count}:{len(approved_from_pool)}")
                                else:
                                    # Нет списка - считаем все согласования
                                    if len(approved_users) < req_count:
                                        raise PermissionError(f"insufficientApprovals:{req_count}:{len(approved_users)}")
                    else:
                        raise PermissionError("transitionNotAllowed")
                
                # Проверяем является ли новый статус финальным
                cursor.execute("""
                    SELECT is_final FROM Task_Manager.workflow_statuses WHERE id = ?
                """, (status_id,))
                new_status_final = cursor.fetchone()
                new_is_final = new_status_final[0] if new_status_final else False
                
                # Проверяем был ли старый статус финальным
                cursor.execute("""
                    SELECT is_final FROM Task_Manager.workflow_statuses WHERE id = ?
                """, (old_status_id,))
                old_status_final = cursor.fetchone()
                old_is_final = old_status_final[0] if old_status_final else False
                
                # Устанавливаем/очищаем дату завершения
                if new_is_final and not old_is_final:
                    # Переход В финальный статус → записываем дату
                    updates.append("completed_at = GETDATE()")
                elif not new_is_final and old_is_final:
                    # Переход ИЗ финального статуса → очищаем дату
                    updates.append("completed_at = NULL")
                
                updates.append("status_id = ?")
                params.append(status_id)
                history_records.append(('status_changed', 'status', str(old_status_id), str(status_id)))
            
            if assignee_id is not None:
                updates.append("assignee_id = ?")
                params.append(assignee_id)
                history_records.append(('assigned', 'assignee', None, str(assignee_id)))
            
            if priority is not None:
                updates.append("priority = ?")
                params.append(priority)
            
            if due_date is not None:
                updates.append("due_date = ?")
                params.append(due_date)
            
            if updates:
                updates.append("updated_at = GETDATE()")
                params.append(task_id)
                
                query = f"UPDATE Task_Manager.tasks SET {', '.join(updates)} WHERE id = ?"
                cursor.execute(query, params)
            
            # Обновляем теги
            if tag_ids is not None:
                cursor.execute("DELETE FROM Task_Manager.task_tags WHERE task_id = ?", (task_id,))
                for tag_id in tag_ids:
                    cursor.execute("""
                        INSERT INTO Task_Manager.task_tags (task_id, tag_id)
                        VALUES (?, ?)
                    """, (task_id, tag_id))
            
            # Записываем историю
            for action_type, field, old_val, new_val in history_records:
                cursor.execute("""
                    INSERT INTO Task_Manager.task_history 
                    (task_id, user_id, action_type, field_changed, old_value, new_value)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (task_id, user_id, action_type, field, old_val, new_val))
            
            conn.commit()
            return True
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
    
    @staticmethod
    def delete_task(task_id: int, user_id: int) -> bool:
        """
        Удалить задачу
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Получаем проект
            cursor.execute("SELECT project_id FROM Task_Manager.tasks WHERE id = ?", (task_id,))
            result = cursor.fetchone()
            
            if not result:
                raise ValueError("taskNotFound")
            
            project_id = result[0]
            
            # Проверяем доступ
            role = TasksService.check_project_access(project_id, user_id)
            if not role:
                raise PermissionError("noProjectAccess")
            
            if role not in ('owner', 'admin'):
                raise PermissionError("onlyOwnerAdminCanDelete")
            
            # СНАЧАЛА удаляем все подзадачи
            cursor.execute("""
                DELETE FROM Task_Manager.tasks 
                WHERE parent_task_id = ?
            """, (task_id,))
            
            # ПОТОМ удаляем саму задачу
            cursor.execute("DELETE FROM Task_Manager.tasks WHERE id = ?", (task_id,))
            conn.commit()
            
            return True
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
    
    @staticmethod
    def reorder_tasks(project_id: int, user_id: int, task_orders: List[Dict]) -> bool:
        """
        Изменить порядок задач в статусе
        task_orders = [{"task_id": 1, "order_index": 0}, ...]
        """
        role = TasksService.check_project_access(project_id, user_id)
        if not role:
            raise PermissionError("noProjectAccess")
        
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            for item in task_orders:
                cursor.execute("""
                    UPDATE Task_Manager.tasks 
                    SET order_index = ?, updated_at = GETDATE()
                    WHERE id = ? AND project_id = ?
                """, (item['order_index'], item['task_id'], project_id))
            
            conn.commit()
            return True
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

