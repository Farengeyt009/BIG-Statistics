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
    def get_project_tasks(
        project_id: int,
        user_id: int,
        parent_task_id: Optional[int] = None,
        include_tags: bool = True,
        include_custom_fields: bool = True,
    ) -> List[Dict]:
        """
        Получить задачи проекта (основные или подзадачи)
        """
        conn = get_connection()
        cursor = conn.cursor()

        try:
            cursor.execute("""
                SELECT role FROM Task_Manager.project_members
                WHERE project_id = ? AND user_id = ?
            """, (project_id, user_id))
            role_row = cursor.fetchone()
            role = role_row[0] if role_row else None
            if not role:
                raise PermissionError("noProjectAccess")
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
                    t.start_date
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

            if not results:
                return results

            task_ids = [task['id'] for task in results]
            placeholders = ",".join(["?"] * len(task_ids))
            subtask_counts: Dict[int, int] = {task_id: 0 for task_id in task_ids}
            comment_counts: Dict[int, int] = {task_id: 0 for task_id in task_ids}
            attachment_counts: Dict[int, int] = {task_id: 0 for task_id in task_ids}

            # Считаем агрегаты только для задач текущей выдачи
            cursor.execute(f"""
                SELECT parent_task_id, COUNT(*)
                FROM Task_Manager.tasks
                WHERE parent_task_id IN ({placeholders})
                GROUP BY parent_task_id
            """, task_ids)
            for row in cursor.fetchall():
                parent_id, cnt = row
                subtask_counts[parent_id] = cnt

            cursor.execute(f"""
                SELECT task_id, COUNT(*)
                FROM Task_Manager.task_comments
                WHERE task_id IN ({placeholders})
                GROUP BY task_id
            """, task_ids)
            for row in cursor.fetchall():
                task_id, cnt = row
                comment_counts[task_id] = cnt

            cursor.execute(f"""
                SELECT task_id, COUNT(*)
                FROM Task_Manager.task_attachments
                WHERE task_id IN ({placeholders})
                GROUP BY task_id
            """, task_ids)
            for row in cursor.fetchall():
                task_id, cnt = row
                attachment_counts[task_id] = cnt

            tags_by_task: Dict[int, List[Dict]] = {task_id: [] for task_id in task_ids}
            if include_tags:
                # Загружаем все теги задач одним запросом
                cursor.execute(f"""
                    SELECT tt.task_id, t.id, t.name, t.color
                    FROM Task_Manager.task_tags tt
                    INNER JOIN Task_Manager.tags t ON t.id = tt.tag_id
                    WHERE tt.task_id IN ({placeholders})
                """, task_ids)
                for row in cursor.fetchall():
                    task_id, tag_id, tag_name, tag_color = row
                    tags_by_task[task_id].append({
                        'id': tag_id,
                        'name': tag_name,
                        'color': tag_color,
                    })

            field_defs: List[Dict] = []
            values_by_task: Dict[int, Dict[int, str]] = {task_id: {} for task_id in task_ids}
            if include_custom_fields:
                # Загружаем определения custom fields один раз
                cursor.execute("""
                    SELECT id as field_id, field_name, field_type
                    FROM Task_Manager.custom_fields
                    WHERE project_id = ? AND is_active = 1
                    ORDER BY order_index, id
                """, (project_id,))
                field_defs = [
                    {'field_id': row[0], 'field_name': row[1], 'field_type': row[2]}
                    for row in cursor.fetchall()
                ]

                if field_defs:
                    cursor.execute(f"""
                        SELECT task_id, field_id, COALESCE(value, '')
                        FROM Task_Manager.custom_field_values
                        WHERE task_id IN ({placeholders})
                    """, task_ids)
                    for row in cursor.fetchall():
                        task_id, field_id, value = row
                        values_by_task[task_id][field_id] = value

            for task in results:
                task_id = task['id']
                task['subtask_count'] = subtask_counts.get(task_id, 0)
                task['comment_count'] = comment_counts.get(task_id, 0)
                task['attachment_count'] = attachment_counts.get(task_id, 0)
                task['tags'] = tags_by_task.get(task_id, [])
                if include_custom_fields:
                    task['custom_fields'] = [
                        {
                            'field_id': fd['field_id'],
                            'field_name': fd['field_name'],
                            'field_type': fd['field_type'],
                            'value': values_by_task[task_id].get(fd['field_id'], ''),
                        }
                        for fd in field_defs
                    ]
                else:
                    task['custom_fields'] = []

            # Approval indicator for board/task cards:
            # determine whether current status has an approval-gated transition
            # and whether approval conditions are already satisfied.
            status_ids = sorted({task['status_id'] for task in results if task.get('status_id') is not None})
            transition_by_status: Dict[int, Dict] = {}
            if status_ids:
                placeholders_status = ",".join(["?"] * len(status_ids))
                cursor.execute(f"""
                    SELECT id, project_id, from_status_id, to_status_id,
                           requires_approvals, required_approvals_count,
                           required_approvers, approval_mode, approver_departments
                    FROM Task_Manager.workflow_transitions
                    WHERE project_id = ?
                      AND requires_approvals = 1
                      AND from_status_id IN ({placeholders_status})
                    ORDER BY from_status_id, id
                """, [project_id] + status_ids)
                for row in cursor.fetchall():
                    status_id = row[2]
                    if status_id in transition_by_status:
                        continue
                    transition_by_status[status_id] = {
                        'id':                       row[0],
                        'project_id':               row[1],
                        'from_status_id':           row[2],
                        'to_status_id':             row[3],
                        'requires_approvals':       bool(row[4]),
                        'required_approvals_count': row[5] or 0,
                        'required_approvers':       row[6],
                        'approval_mode':            row[7] or 'count',
                        'approver_departments':     row[8],
                    }

            from .approvals_service import ApprovalsService
            task_ids_for_approvals = [task['id'] for task in results]
            latest_approval_transition_by_task: Dict[int, int] = {}
            user_approved_pairs = set()
            fallback_transition_ids = set()

            if task_ids_for_approvals:
                task_ph = ",".join(["?"] * len(task_ids_for_approvals))
                cursor.execute(f"""
                    SELECT task_id, transition_id, user_id
                    FROM Task_Manager.task_approvals
                    WHERE task_id IN ({task_ph})
                      AND transition_id IS NOT NULL
                    ORDER BY approved_at DESC
                """, task_ids_for_approvals)
                for row in cursor.fetchall():
                    task_id_row, transition_id_row, approved_user_id = row
                    if task_id_row not in latest_approval_transition_by_task:
                        latest_approval_transition_by_task[task_id_row] = transition_id_row
                    if approved_user_id == user_id:
                        user_approved_pairs.add((task_id_row, transition_id_row))
                    fallback_transition_ids.add(transition_id_row)

            fallback_transition_map: Dict[int, Dict] = {}
            if fallback_transition_ids:
                fallback_ids_list = sorted(fallback_transition_ids)
                tr_ph = ",".join(["?"] * len(fallback_ids_list))
                cursor.execute(f"""
                    SELECT id, project_id, from_status_id, to_status_id,
                           requires_approvals, required_approvals_count,
                           required_approvers, approval_mode, approver_departments
                    FROM Task_Manager.workflow_transitions
                    WHERE id IN ({tr_ph})
                """, fallback_ids_list)
                for row in cursor.fetchall():
                    fallback_transition_map[row[0]] = {
                        'id':                       row[0],
                        'project_id':               row[1],
                        'from_status_id':           row[2],
                        'to_status_id':             row[3],
                        'requires_approvals':       bool(row[4]),
                        'required_approvals_count': row[5] or 0,
                        'required_approvers':       row[6],
                        'approval_mode':            row[7] or 'count',
                        'approver_departments':     row[8],
                    }

            for task in results:
                # 1) Prefer active transition for current status.
                transition = transition_by_status.get(task['status_id'])
                # 2) If task already moved forward, fall back to latest approval transition.
                if not transition:
                    fallback_tid = latest_approval_transition_by_task.get(task['id'])
                    transition = fallback_transition_map.get(fallback_tid) if fallback_tid else None

                if not transition or not transition.get('requires_approvals'):
                    task['has_approval_requirement'] = False
                    task['approval_conditions_met'] = False
                    task['approval_current_user_approved'] = False
                    continue

                task['has_approval_requirement'] = True
                task['approval_conditions_met'] = ApprovalsService._check_conditions_met(
                    cursor, task['id'], transition
                )
                task['approval_current_user_approved'] = (
                    (task['id'], transition['id']) in user_approved_pairs
                )

            return results
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def get_project_history(project_id: int, user_id: int, limit: int = 20) -> List[Dict]:
        """
        Получить последние изменения задач проекта
        """
        role = TasksService.check_project_access(project_id, user_id)
        if not role:
            raise PermissionError("noProjectAccess")

        conn = get_connection()
        cursor = conn.cursor()

        try:
            query = """
                SELECT
                    h.id,
                    h.task_id,
                    t.title AS task_title,
                    h.user_id,
                    u.Username AS user_name,
                    u.FullName AS user_full_name,
                    h.action_type,
                    h.field_changed,
                    CASE
                        WHEN h.field_changed = 'status' THEN COALESCE(ws_old.name, h.old_value)
                        WHEN h.field_changed = 'assignee' THEN COALESCE(u_old.FullName, u_old.Username, h.old_value)
                        ELSE h.old_value
                    END AS old_value,
                    CASE
                        WHEN h.field_changed = 'status' THEN COALESCE(ws_new.name, h.new_value)
                        WHEN h.field_changed = 'assignee' THEN COALESCE(u_new.FullName, u_new.Username, h.new_value)
                        ELSE h.new_value
                    END AS new_value,
                    h.created_at
                FROM Task_Manager.task_history h
                INNER JOIN Task_Manager.tasks t ON t.id = h.task_id
                LEFT JOIN Users.users u ON u.UserID = h.user_id
                LEFT JOIN Task_Manager.workflow_statuses ws_old ON ws_old.id = TRY_CAST(h.old_value AS INT)
                LEFT JOIN Task_Manager.workflow_statuses ws_new ON ws_new.id = TRY_CAST(h.new_value AS INT)
                LEFT JOIN Users.users u_old ON u_old.UserID = TRY_CAST(h.old_value AS INT)
                LEFT JOIN Users.users u_new ON u_new.UserID = TRY_CAST(h.new_value AS INT)
                WHERE t.project_id = ?
                ORDER BY h.created_at DESC
                OFFSET 0 ROWS FETCH NEXT ? ROWS ONLY
            """

            cursor.execute(query, (project_id, limit))
            columns = [column[0] for column in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]
        finally:
            cursor.close()
            conn.close()
    
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
                t.updated_at,
                t.start_date
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
                   due_date: Optional[str] = None, start_date: Optional[str] = None,
                   parent_task_id: Optional[int] = None,
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
            else:
                # Явно проверяем, что переданный статус принадлежит проекту
                cursor.execute("""
                    SELECT is_initial
                    FROM Task_Manager.workflow_statuses
                    WHERE id = ? AND project_id = ?
                """, (status_id, project_id))
                st_row = cursor.fetchone()
                if st_row is None:
                    raise ValueError("invalidStatus")

                # Проверяем, разрешено ли создание задач в указанном статусе
                # Подзадачи не ограничиваем — они создаются в контексте родителя
                if parent_task_id is None:
                    # Сначала проверяем включено ли ограничение для проекта
                    cursor.execute(
                        "SELECT has_creation_restriction FROM Task_Manager.projects WHERE id = ?",
                        (project_id,)
                    )
                    restriction_row = cursor.fetchone()
                    restriction_enabled = bool(restriction_row[0]) if restriction_row else False

                    if restriction_enabled:
                        if not st_row[0]:
                            raise PermissionError("cannotCreateInStatus")
            
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
                 assignee_id, creator_id, priority, due_date, start_date)
                OUTPUT INSERTED.id
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (project_id, parent_task_id, title, description, status_id,
                  assignee_id, user_id, priority, due_date, start_date))
            
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

            # Отдельно логируем создание подзадачи в истории родительской задачи
            if parent_task_id is not None:
                cursor.execute("""
                    INSERT INTO Task_Manager.task_history (task_id, user_id, action_type, field_changed, new_value)
                    VALUES (?, ?, 'subtask_created', 'subtask', ?)
                """, (parent_task_id, user_id, f"{task_id}:{title}"))
            
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
                   assignee_id: Optional[int] = None, clear_assignee: bool = False,
                   priority: Optional[str] = None,
                   due_date: Optional[str] = None, clear_due_date: bool = False,
                   start_date: Optional[str] = None, clear_start_date: bool = False,
                   tag_ids: Optional[List[int]] = None) -> bool:
        """
        Обновить задачу
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Получаем текущую задачу
            cursor.execute("""
                SELECT project_id, parent_task_id, status_id, assignee_id, priority, due_date, start_date, title
                FROM Task_Manager.tasks
                WHERE id = ?
            """, (task_id,))
            result = cursor.fetchone()
            
            if not result:
                raise ValueError("taskNotFound")
            
            project_id, old_parent_task_id, old_status_id, old_assignee_id, old_priority, old_due_date, old_start_date, old_title = result
            
            # Проверяем доступ в рамках текущего соединения (без доп. round-trip)
            cursor.execute("""
                SELECT role FROM Task_Manager.project_members
                WHERE project_id = ? AND user_id = ?
            """, (project_id, user_id))
            role_row = cursor.fetchone()
            role = role_row[0] if role_row else None
            if not role:
                raise PermissionError("noProjectAccess")
            
            if role == 'viewer':
                raise PermissionError("viewerCannotEdit")

            # Проверка кастомных прав по статусу (если включены для проекта)
            if role == 'member':
                cursor.execute(
                    "SELECT has_status_permissions FROM Task_Manager.projects WHERE id = ?",
                    (project_id,)
                )
                perm_row = cursor.fetchone()
                if perm_row and perm_row[0]:
                    cursor.execute("""
                        SELECT user_ids, department_ids
                        FROM Task_Manager.status_edit_permissions
                        WHERE project_id = ? AND status_id = ?
                    """, (project_id, old_status_id))
                    perm = cursor.fetchone()
                    if perm:
                        import json as _pjson
                        allowed_user_ids = _pjson.loads(perm[0]) if perm[0] else []
                        allowed_dept_ids = _pjson.loads(perm[1]) if perm[1] else []
                        user_allowed = user_id in allowed_user_ids
                        dept_allowed = False
                        if allowed_dept_ids and not user_allowed:
                            cursor.execute(
                                "SELECT department_id FROM Users.Users WHERE UserID = ?",
                                (user_id,)
                            )
                            dept_row = cursor.fetchone()
                            if dept_row and dept_row[0] in allowed_dept_ids:
                                dept_allowed = True
                        if not user_allowed and not dept_allowed:
                            raise PermissionError("statusEditRestricted")
                    else:
                        # Нет настройки для этого статуса → member здесь viewer
                        raise PermissionError("statusEditRestricted")            # Формируем UPDATE
            updates = []
            params = []
            history_records = []
            
            if title is not None:
                updates.append("title = ?")
                params.append(title)
                if title != old_title:
                    history_records.append(('updated', 'title', old_title, title))
            
            if description is not None:
                updates.append("description = ?")
                params.append(description)
            
            if status_id is not None and status_id != old_status_id:
                # Новый статус должен принадлежать тому же проекту
                cursor.execute("""
                    SELECT 1
                    FROM Task_Manager.workflow_statuses
                    WHERE id = ? AND project_id = ?
                """, (status_id, project_id))
                if not cursor.fetchone():
                    raise ValueError("invalidStatus")

                # Проверяем права на переход, если они настроены
                cursor.execute("""
                    SELECT has_workflow_permissions FROM Task_Manager.projects WHERE id = ?
                """, (project_id,))
                
                has_permissions = cursor.fetchone()[0]
                
                if has_permissions:
                    # Проверяем прямой переход или обратный (двунаправленный)
                    cursor.execute("""
                        SELECT id, permission_type, allowed_roles, allowed_users, is_bidirectional, requires_attachment,
                               requires_approvals, required_approvals_count, required_approvers,
                               approval_mode, approver_departments, required_fields
                        FROM Task_Manager.workflow_transitions
                        WHERE project_id = ? AND (
                            (from_status_id = ? AND to_status_id = ?) OR
                            (from_status_id = ? AND to_status_id = ? AND is_bidirectional = 1)
                        )
                    """, (project_id, old_status_id, status_id, status_id, old_status_id))
                    
                    transition = cursor.fetchone()
                    if transition:
                        (
                            transition_id,
                            permission_type,
                            allowed_roles,
                            allowed_users,
                            is_bidirectional,
                            requires_attachment,
                            req_approvals,
                            req_count,
                            req_approvers,
                            approval_mode,
                            approver_departments,
                            req_fields,
                        ) = transition
                        
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
                        elif permission_type == 'departments':
                            if allowed_users:
                                import json
                                dept_list = json.loads(allowed_users) if isinstance(allowed_users, str) else allowed_users
                                cursor.execute(
                                    "SELECT department_id FROM Users.Users WHERE UserID = ?",
                                    (user_id,)
                                )
                                dept_row = cursor.fetchone()
                                user_dept_id = dept_row[0] if dept_row else None
                                if user_dept_id not in dept_list:
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
                        
                        # Проверка согласований по переходу
                        if req_approvals:
                            # Используем единую логику v2, чтобы проверки совпадали с approvals_service
                            import json as _json
                            from .approvals_service import ApprovalsService

                            transition_ctx = {
                                'id': transition_id,
                                'project_id': project_id,
                                'required_approvals_count': req_count or 0,
                                'required_approvers': req_approvers,
                                'approval_mode': approval_mode or 'count',
                                'approver_departments': approver_departments,
                            }
                            conditions_met = ApprovalsService._check_conditions_met(cursor, task_id, transition_ctx)
                            if not conditions_met:
                                approved_users = ApprovalsService._get_approved_user_ids(cursor, task_id, transition_id)
                                mode = transition_ctx['approval_mode']
                                required_for_error = 1
                                current_for_error = 0

                                if mode == 'all':
                                    if req_approvers:
                                        pool = _json.loads(req_approvers) if isinstance(req_approvers, str) else req_approvers
                                    elif approver_departments:
                                        dept_ids = _json.loads(approver_departments) if isinstance(approver_departments, str) else approver_departments
                                        pool = ApprovalsService._get_users_in_departments(cursor, dept_ids or [], project_id)
                                    else:
                                        pool = []
                                    required_for_error = max(1, len(pool))
                                    current_for_error = len([u for u in approved_users if u in pool]) if pool else len(approved_users)
                                elif mode == 'count':
                                    required_for_error = max(1, int(req_count or 0))
                                    if approver_departments:
                                        dept_ids = _json.loads(approver_departments) if isinstance(approver_departments, str) else approver_departments
                                        current_for_error = sum(
                                            1 for did in (dept_ids or [])
                                            if any(
                                                u in approved_users
                                                for u in ApprovalsService._get_users_in_department(cursor, did, project_id)
                                            )
                                        )
                                    elif req_approvers:
                                        pool = _json.loads(req_approvers) if isinstance(req_approvers, str) else req_approvers
                                        current_for_error = len([u for u in approved_users if u in (pool or [])])
                                    else:
                                        current_for_error = len(approved_users)
                                else:
                                    required_for_error = 1
                                    current_for_error = 1 if approved_users else 0

                                raise PermissionError(
                                    f"insufficientApprovals:{required_for_error}:{current_for_error}"
                                )

                        # Проверка обязательных полей перед переходом
                        if req_fields:
                            import json as _json
                            field_keys = _json.loads(req_fields) if isinstance(req_fields, str) else req_fields

                            # Нужны актуальные данные задачи для проверки стандартных полей
                            cursor.execute("""
                                SELECT title, description, assignee_id, due_date, priority
                                FROM Task_Manager.tasks WHERE id = ?
                            """, (task_id,))
                            task_row = cursor.fetchone()
                            t_title, t_desc, t_assignee, t_due, t_priority = task_row if task_row else (None, None, None, None, None)

                            # Применяем pending-изменения из текущего вызова
                            if title is not None:
                                t_title = title
                            if description is not None:
                                t_desc = description
                            if assignee_id is not None:
                                t_assignee = assignee_id
                            if clear_assignee:
                                t_assignee = None
                            if due_date is not None:
                                t_due = due_date
                            if clear_due_date:
                                t_due = None
                            if priority is not None:
                                t_priority = priority

                            STANDARD_FIELD_NAMES = {
                                'title': 'Title',
                                'description': 'Description',
                                'assignee_id': 'Assignee',
                                'due_date': 'Due Date',
                                'priority': 'Priority',
                            }

                            missing_names = []
                            for key in field_keys:
                                if key == 'title':
                                    if not t_title or not str(t_title).strip():
                                        missing_names.append(STANDARD_FIELD_NAMES['title'])
                                elif key == 'description':
                                    if not t_desc or not str(t_desc).strip():
                                        missing_names.append(STANDARD_FIELD_NAMES['description'])
                                elif key == 'assignee_id':
                                    if not t_assignee:
                                        missing_names.append(STANDARD_FIELD_NAMES['assignee_id'])
                                elif key == 'due_date':
                                    if not t_due:
                                        missing_names.append(STANDARD_FIELD_NAMES['due_date'])
                                elif key == 'priority':
                                    if not t_priority or t_priority == 'none':
                                        missing_names.append(STANDARD_FIELD_NAMES['priority'])
                                elif key.startswith('custom_'):
                                    cf_id = int(key.split('_')[1])
                                    # Получаем имя поля и проверяем заполненность
                                    cursor.execute("""
                                        SELECT f.field_name, COUNT(v.id)
                                        FROM Task_Manager.custom_fields f
                                        LEFT JOIN Task_Manager.task_custom_field_rows r ON r.task_id = ?
                                        LEFT JOIN Task_Manager.task_custom_field_values v
                                            ON v.row_id = r.id AND v.field_id = f.id
                                            AND v.value IS NOT NULL AND v.value != ''
                                        WHERE f.id = ?
                                        GROUP BY f.field_name
                                    """, (task_id, cf_id))
                                    cf_row = cursor.fetchone()
                                    if cf_row:
                                        cf_name, cf_count = cf_row
                                        if cf_count == 0:
                                            missing_names.append(cf_name)
                                    else:
                                        missing_names.append(f'custom_{cf_id}')

                            if missing_names:
                                raise PermissionError(f"requiredFieldsMissing:{','.join(missing_names)}")
                    else:
                        raise PermissionError("transitionNotAllowed")
                
                # Проверяем финальность статусов одним запросом
                cursor.execute("""
                    SELECT id, is_final
                    FROM Task_Manager.workflow_statuses
                    WHERE id IN (?, ?)
                """, (status_id, old_status_id))
                status_flags = {row[0]: bool(row[1]) for row in cursor.fetchall()}
                new_is_final = status_flags.get(status_id, False)
                old_is_final = status_flags.get(old_status_id, False)
                
                # Устанавливаем/очищаем дату завершения
                if new_is_final and not old_is_final:
                    # Переход В финальный статус → записываем дату
                    updates.append("completed_at = GETUTCDATE()")
                elif not new_is_final and old_is_final:
                    # Переход ИЗ финального статуса → очищаем дату
                    updates.append("completed_at = NULL")
                
                updates.append("status_id = ?")
                params.append(status_id)
                history_records.append(('status_changed', 'status', str(old_status_id), str(status_id)))

                # Отдельно логируем завершение подзадачи в истории родительской задачи
                if old_parent_task_id is not None and new_is_final and not old_is_final:
                    history_records.append(('subtask_completed', 'subtask', None, f"{task_id}:{old_title}"))
            
            if assignee_id is not None or clear_assignee:
                updates.append("assignee_id = ?")
                params.append(assignee_id)  # None → NULL in SQL
                if assignee_id != old_assignee_id:
                    history_records.append((
                        'assigned',
                        'assignee',
                        str(old_assignee_id) if old_assignee_id else None,
                        str(assignee_id) if assignee_id else None
                    ))
            
            if priority is not None:
                updates.append("priority = ?")
                params.append(priority)
                if priority != old_priority:
                    history_records.append(('updated', 'priority', old_priority, priority))
            
            if due_date is not None or clear_due_date:
                updates.append("due_date = ?")
                params.append(due_date)
                new_due = due_date if due_date is not None else None
                old_due = old_due_date.isoformat() if old_due_date else None
                if old_due != new_due:
                    history_records.append(('updated', 'due_date', old_due, new_due))

            if start_date is not None or clear_start_date:
                updates.append("start_date = ?")
                params.append(start_date)
                new_start = start_date if start_date is not None else None
                old_start = old_start_date.isoformat() if old_start_date else None
                if old_start != new_start:
                    history_records.append(('updated', 'start_date', old_start, new_start))
            
            if updates:
                updates.append("updated_at = GETUTCDATE()")
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
                history_task_id = old_parent_task_id if action_type == 'subtask_completed' and old_parent_task_id is not None else task_id
                cursor.execute("""
                    INSERT INTO Task_Manager.task_history 
                    (task_id, user_id, action_type, field_changed, old_value, new_value)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (history_task_id, user_id, action_type, field, old_val, new_val))
            
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
            # Получаем задачу
            cursor.execute("SELECT project_id, parent_task_id, title FROM Task_Manager.tasks WHERE id = ?", (task_id,))
            result = cursor.fetchone()
            
            if not result:
                raise ValueError("taskNotFound")
            
            project_id, parent_task_id, task_title = result
            
            # Проверяем доступ
            role = TasksService.check_project_access(project_id, user_id)
            if not role:
                raise PermissionError("noProjectAccess")
            
            if role not in ('owner', 'admin'):
                raise PermissionError("onlyOwnerAdminCanDelete")
            
            # Логируем удаление
            if parent_task_id is not None:
                cursor.execute("""
                    INSERT INTO Task_Manager.task_history
                    (task_id, user_id, action_type, field_changed, new_value)
                    VALUES (?, ?, 'subtask_deleted', 'subtask', ?)
                """, (parent_task_id, user_id, f"{task_id}:{task_title}"))
            else:
                cursor.execute("""
                    INSERT INTO Task_Manager.task_history
                    (task_id, user_id, action_type, field_changed, new_value)
                    VALUES (?, ?, 'task_deleted', 'task', ?)
                """, (task_id, user_id, task_title))

            # Рекурсивно удаляем все вложенные подзадачи (любой глубины) через CTE
            # SQL Server не поддерживает ON DELETE CASCADE на self-referencing таблицах,
            # поэтому удаление вложенных задач обрабатываем вручную.
            cursor.execute("""
                WITH subtree AS (
                    SELECT id FROM Task_Manager.tasks WHERE id = ?
                    UNION ALL
                    SELECT t.id FROM Task_Manager.tasks t
                    INNER JOIN subtree s ON t.parent_task_id = s.id
                )
                DELETE FROM Task_Manager.tasks
                WHERE id IN (SELECT id FROM subtree WHERE id <> ?)
            """, (task_id, task_id))

            # Удаляем саму задачу (её FK CASCADE сам удалит comments/attachments/history/tags/approvals)
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
    def toggle_subtask_complete(subtask_id: int, user_id: int) -> bool:
        """
        Переключить чекбокс подзадачи (done/open) без проверки workflow transitions
        """
        conn = get_connection()
        cursor = conn.cursor()

        try:
            cursor.execute("""
                SELECT t.project_id, t.parent_task_id, t.status_id, t.title, ws.is_final
                FROM Task_Manager.tasks t
                LEFT JOIN Task_Manager.workflow_statuses ws ON ws.id = t.status_id
                WHERE t.id = ?
            """, (subtask_id,))
            row = cursor.fetchone()

            if not row:
                raise ValueError("taskNotFound")

            project_id, parent_task_id, old_status_id, subtask_title, old_is_final = row

            if parent_task_id is None:
                raise ValueError("notSubtask")

            role = TasksService.check_project_access(project_id, user_id)
            if not role:
                raise PermissionError("noProjectAccess")
            if role == 'viewer':
                raise PermissionError("viewerCannotEdit")

            cursor.execute("""
                SELECT id, name, is_final, is_initial, order_index
                FROM Task_Manager.workflow_statuses
                WHERE project_id = ?
                ORDER BY order_index, id
            """, (project_id,))
            statuses = [
                {
                    "id": s[0],
                    "name": s[1] or "",
                    "is_final": bool(s[2]),
                    "is_initial": bool(s[3]),
                }
                for s in cursor.fetchall()
            ]

            cancellation_markers = ["cancel", "отмен", "取消"]
            final_statuses = [s for s in statuses if s["is_final"]]
            non_cancel_final = [
                s for s in final_statuses
                if not any(marker in s["name"].lower() for marker in cancellation_markers)
            ]
            final_status = non_cancel_final[0] if non_cancel_final else (final_statuses[0] if final_statuses else None)
            open_status = (
                next((s for s in statuses if s["is_initial"]), None)
                or next((s for s in statuses if not s["is_final"]), None)
            )

            if not final_status or not open_status:
                raise ValueError("invalidWorkflowStatuses")

            new_status_id = open_status["id"] if old_is_final else final_status["id"]
            new_is_final = new_status_id == final_status["id"]

            cursor.execute("""
                UPDATE Task_Manager.tasks
                SET status_id = ?, updated_at = GETUTCDATE(), completed_at = CASE WHEN ? = 1 THEN GETUTCDATE() ELSE NULL END
                WHERE id = ?
            """, (new_status_id, 1 if new_is_final else 0, subtask_id))

            # Базовая запись изменения статуса
            cursor.execute("""
                INSERT INTO Task_Manager.task_history
                (task_id, user_id, action_type, field_changed, old_value, new_value)
                VALUES (?, ?, 'status_changed', 'status', ?, ?)
            """, (subtask_id, user_id, str(old_status_id), str(new_status_id)))

            # Событие завершения подзадачи — пишем на родительскую задачу
            if new_is_final and not old_is_final:
                cursor.execute("""
                    INSERT INTO Task_Manager.task_history
                    (task_id, user_id, action_type, field_changed, new_value)
                    VALUES (?, ?, 'subtask_completed', 'subtask', ?)
                """, (parent_task_id, user_id, f"{subtask_id}:{subtask_title}"))

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
        if role == 'viewer':
            raise PermissionError("viewerCannotEdit")
        
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            for item in task_orders:
                cursor.execute("""
                    UPDATE Task_Manager.tasks 
                    SET order_index = ?, updated_at = GETUTCDATE()
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

