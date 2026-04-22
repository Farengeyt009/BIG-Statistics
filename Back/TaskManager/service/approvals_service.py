"""
Сервис для работы с согласованиями задач (v2).

Логика:
- approval_mode: 'any_member' | 'count' | 'all'
- approver pool: required_approvers (user IDs) или approver_departments (dept IDs)
- При отзыве согласования: если условия перехода больше не выполнены —
  задача автоматически возвращается на transition.from_status_id
"""
import json
from typing import List, Dict, Optional

from Back.database.db_connector import get_connection


class ApprovalsService:

    # ─────────────────────────── helpers ───────────────────────────

    @staticmethod
    def _get_users_in_department(cursor, department_id: int, project_id: Optional[int] = None) -> List[int]:
        if project_id is not None:
            cursor.execute(
                """
                SELECT DISTINCT u.UserID
                FROM Users.Users u
                INNER JOIN Task_Manager.project_members pm ON pm.user_id = u.UserID
                WHERE u.department_id = ? AND u.IsActive = 1 AND pm.project_id = ?
                """,
                (department_id, project_id)
            )
            return [row[0] for row in cursor.fetchall()]

        cursor.execute(
            "SELECT UserID FROM Users.Users WHERE department_id = ? AND IsActive = 1",
            (department_id,)
        )
        return [row[0] for row in cursor.fetchall()]

    @staticmethod
    def _get_users_in_departments(
        cursor, department_ids: List[int], project_id: Optional[int] = None
    ) -> List[int]:
        if not department_ids:
            return []
        placeholders = ','.join(['?' for _ in department_ids])

        if project_id is not None:
            cursor.execute(
                f"""
                SELECT DISTINCT u.UserID
                FROM Users.Users u
                INNER JOIN Task_Manager.project_members pm ON pm.user_id = u.UserID
                WHERE u.department_id IN ({placeholders})
                  AND u.IsActive = 1
                  AND pm.project_id = ?
                """,
                department_ids + [project_id]
            )
            return [row[0] for row in cursor.fetchall()]

        cursor.execute(
            f"SELECT DISTINCT UserID FROM Users.Users WHERE department_id IN ({placeholders}) AND IsActive = 1",
            department_ids
        )
        return [row[0] for row in cursor.fetchall()]

    @staticmethod
    def _get_department_users_map(
        cursor, department_ids: List[int], project_id: Optional[int] = None
    ) -> Dict[int, List[int]]:
        if not department_ids:
            return {}

        placeholders = ','.join(['?' for _ in department_ids])
        mapping: Dict[int, List[int]] = {did: [] for did in department_ids}

        if project_id is not None:
            cursor.execute(
                f"""
                SELECT u.department_id, u.UserID
                FROM Users.Users u
                INNER JOIN Task_Manager.project_members pm ON pm.user_id = u.UserID
                WHERE u.department_id IN ({placeholders})
                  AND u.IsActive = 1
                  AND pm.project_id = ?
                """,
                department_ids + [project_id]
            )
        else:
            cursor.execute(
                f"""
                SELECT department_id, UserID
                FROM Users.Users
                WHERE department_id IN ({placeholders}) AND IsActive = 1
                """,
                department_ids
            )

        for dept_id, uid in cursor.fetchall():
            mapping.setdefault(dept_id, []).append(uid)
        return mapping

    @staticmethod
    def _get_user_info_map(cursor, user_ids: List[int]) -> Dict[int, Dict]:
        if not user_ids:
            return {}
        placeholders = ','.join(['?' for _ in user_ids])
        cursor.execute(
            f"""
            SELECT UserID, Username, FullName
            FROM Users.Users
            WHERE UserID IN ({placeholders})
            """,
            user_ids
        )
        return {
            row[0]: {'user_id': row[0], 'username': row[1], 'full_name': row[2]}
            for row in cursor.fetchall()
        }

    @staticmethod
    def _get_transition(cursor, transition_id: int) -> Optional[Dict]:
        cursor.execute("""
            SELECT id, project_id, from_status_id, to_status_id,
                   requires_approvals, required_approvals_count,
                   required_approvers, approval_mode, approver_departments
            FROM Task_Manager.workflow_transitions
            WHERE id = ?
        """, (transition_id,))
        row = cursor.fetchone()
        if not row:
            return None
        return {
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

    @staticmethod
    def _get_approved_user_ids(cursor, task_id: int, transition_id: int) -> List[int]:
        cursor.execute(
            "SELECT user_id FROM Task_Manager.task_approvals WHERE task_id = ? AND transition_id = ?",
            (task_id, transition_id)
        )
        return [row[0] for row in cursor.fetchall()]

    @staticmethod
    def _check_conditions_met(cursor, task_id: int, transition: Dict) -> bool:
        """Вернуть True если условия согласования для данного перехода выполнены."""
        approved = ApprovalsService._get_approved_user_ids(cursor, task_id, transition['id'])
        mode = transition['approval_mode']

        user_ids: List[int] = (
            json.loads(transition['required_approvers'])
            if transition['required_approvers'] else []
        )
        dept_ids: List[int] = (
            json.loads(transition['approver_departments'])
            if transition['approver_departments'] else []
        )

        if mode == 'any_member':
            return len(approved) >= 1

        if mode == 'all':
            if user_ids:
                return all(u in approved for u in user_ids)
            if dept_ids:
                # Все участники проекта из выбранных отделов должны согласовать.
                dept_users_map = ApprovalsService._get_department_users_map(
                    cursor, dept_ids, transition['project_id']
                )
                pool_users = [uid for users in dept_users_map.values() for uid in users]
                if not pool_users:
                    return False
                return all(u in approved for u in pool_users)
            return len(approved) >= 1

        # mode == 'count'
        required = transition['required_approvals_count']
        if not required:
            return True
        if dept_ids:
            # Считаем отделы: каждый отдел засчитывается если хотя бы один его участник согласовал
            dept_users_map = ApprovalsService._get_department_users_map(
                cursor, dept_ids, transition['project_id']
            )
            approved_dept_count = sum(
                1 for did in dept_ids
                if any(u in approved for u in dept_users_map.get(did, []))
            )
            return approved_dept_count >= required
        if user_ids:
            return len([u for u in approved if u in user_ids]) >= required
        return len(approved) >= required

    # ─────────────────────── public API ────────────────────────────

    @staticmethod
    def get_task_approvals(task_id: int, user_id: int) -> List[Dict]:
        """Получить список согласований задачи."""
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                SELECT t.project_id
                FROM Task_Manager.tasks t
                INNER JOIN Task_Manager.project_members pm ON t.project_id = pm.project_id
                WHERE t.id = ? AND pm.user_id = ?
            """, (task_id, user_id))
            if not cursor.fetchone():
                raise PermissionError("Нет доступа к задаче")

            cursor.execute("""
                SELECT ta.id, ta.task_id, ta.user_id,
                       u.Username AS username, u.FullName AS full_name,
                       ta.approved_at, ta.comment, ta.transition_id
                FROM Task_Manager.task_approvals ta
                INNER JOIN Users.users u ON ta.user_id = u.UserID
                WHERE ta.task_id = ?
                ORDER BY ta.approved_at DESC
            """, (task_id,))
            columns = [c[0] for c in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def get_pending_approvers(task_id: int, transition_id: int, requesting_user_id: int) -> Dict:
        """
        Вернуть словарь:
          approved  — список кто уже согласовал
          pending   — список кто ещё не согласовал (если пул задан)
          mode      — режим согласования
          conditions_met — выполнены ли условия
        """
        conn = get_connection()
        cursor = conn.cursor()
        try:
            # Проверяем доступ к задаче
            cursor.execute("""
                SELECT t.project_id
                FROM Task_Manager.tasks t
                INNER JOIN Task_Manager.project_members pm ON pm.project_id = t.project_id
                WHERE t.id = ? AND pm.user_id = ?
            """, (task_id, requesting_user_id))
            task_row = cursor.fetchone()
            if not task_row:
                raise PermissionError("Нет доступа к задаче")
            task_project_id = task_row[0]

            transition = ApprovalsService._get_transition(cursor, transition_id)
            if not transition:
                return {'approved': [], 'pending': [], 'mode': 'any_member', 'conditions_met': False}
            if transition['project_id'] != task_project_id:
                raise PermissionError("Нет доступа к переходу")

            approved_ids = ApprovalsService._get_approved_user_ids(cursor, task_id, transition_id)
            mode = transition['approval_mode']

            user_ids: List[int] = (
                json.loads(transition['required_approvers'])
                if transition['required_approvers'] else []
            )
            dept_ids: List[int] = (
                json.loads(transition['approver_departments'])
                if transition['approver_departments'] else []
            )

            approved_details: List[Dict] = []
            pending_details: List[Dict] = []
            department_progress: List[Dict] = []

            preloaded_user_ids = set(approved_ids) | set(user_ids)
            dept_users_map: Dict[int, List[int]] = {}
            if dept_ids:
                dept_users_map = ApprovalsService._get_department_users_map(
                    cursor, dept_ids, transition['project_id']
                )
                for users in dept_users_map.values():
                    preloaded_user_ids.update(users)
            user_info_map = ApprovalsService._get_user_info_map(cursor, list(preloaded_user_ids))

            if mode == 'any_member':
                for uid in approved_ids:
                    info = user_info_map.get(uid)
                    if info:
                        approved_details.append(info)

            elif user_ids:
                for uid in user_ids:
                    info = user_info_map.get(uid)
                    if not info:
                        continue
                    if uid in approved_ids:
                        approved_details.append(info)
                    else:
                        pending_details.append(info)

            elif dept_ids:
                cursor.execute(
                    "SELECT DepartmentID, Name FROM Users.Departments WHERE DepartmentID IN ({})".format(
                        ','.join(['?' for _ in dept_ids])
                    ), dept_ids
                )
                depts = cursor.fetchall()

                for dept_row in depts:
                    did, dname = dept_row[0], dept_row[1]
                    dept_users = dept_users_map.get(did, [])
                    approved_from_dept = [u for u in approved_ids if u in dept_users]
                    department_progress.append({
                        'department_id': did,
                        'department': dname,
                        'approved_count': len(approved_from_dept),
                        'total_count': len(dept_users),
                    })

                    if mode == 'all':
                        for uid in dept_users:
                            info = user_info_map.get(uid)
                            if not info:
                                continue
                            info = {**info, 'department': dname}
                            if uid in approved_ids:
                                approved_details.append(info)
                            else:
                                pending_details.append(info)
                    else:
                        if approved_from_dept:
                            info = user_info_map.get(approved_from_dept[0])
                            if info:
                                info = {**info, 'department': dname}
                                approved_details.append(info)
                        else:
                            pending_details.append({'department': dname, 'department_id': did, 'type': 'department'})

                # Для mode=count НЕ обрезаем pending до required_count.
                # Иначе при required=1 и нескольких выбранных отделах интерфейс
                # ошибочно показывает, что нужен "первый" отдел.
                # Бизнес-логика: достаточно согласования от ЛЮБОГО из pending отделов.

            else:
                for uid in approved_ids:
                    info = user_info_map.get(uid)
                    if info:
                        approved_details.append(info)

            return {
                'approved': approved_details,
                'pending': pending_details,
                'department_progress': department_progress,
                'mode': mode,
                'required_count': transition['required_approvals_count'],
                'conditions_met': ApprovalsService._check_conditions_met(cursor, task_id, transition),
            }
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def add_approval(task_id: int, user_id: int,
                     comment: str = None, transition_id: int = None) -> int:
        """Добавить согласование задачи."""
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
            task_project_id = result[0]
            if result[1] == 'viewer':
                raise PermissionError("Viewer не может согласовывать задачи")

            # Проверяем, что пользователь входит в пул согласующих для transition (если задан)
            if transition_id:
                transition = ApprovalsService._get_transition(cursor, transition_id)
                if not transition or transition['project_id'] != task_project_id:
                    raise PermissionError("Нет доступа к переходу")

                # Критично: согласовывать можно только когда задача реально находится
                # в from_status этого transition. Это защищает от race-condition на UI
                # (оптимистичный drag&drop + быстрое открытие модалки).
                cursor.execute(
                    "SELECT status_id FROM Task_Manager.tasks WHERE id = ?",
                    (task_id,)
                )
                task_status_row = cursor.fetchone()
                current_status_id = task_status_row[0] if task_status_row else None
                if current_status_id != transition['from_status_id']:
                    raise PermissionError("transitionNotAllowed")

                if transition['requires_approvals']:
                    mode = transition['approval_mode'] or 'count'
                    user_ids: List[int] = (
                        json.loads(transition['required_approvers'])
                        if transition['required_approvers'] else []
                    )
                    dept_ids: List[int] = (
                        json.loads(transition['approver_departments'])
                        if transition['approver_departments'] else []
                    )

                    # any_member и пустой пул означают, что согласовать может любой участник проекта (кроме viewer)
                    if mode != 'any_member' and (user_ids or dept_ids):
                        if user_ids and user_id not in user_ids:
                            raise PermissionError("insufficientUser")
                        if dept_ids:
                            cursor.execute(
                                "SELECT department_id FROM Users.Users WHERE UserID = ?",
                                (user_id,)
                            )
                            dept_row = cursor.fetchone()
                            user_dept_id = dept_row[0] if dept_row else None
                            if user_dept_id not in dept_ids:
                                raise PermissionError("insufficientUser")

            # Проверяем дубликат
            dup_sql = "SELECT id FROM Task_Manager.task_approvals WHERE task_id = ? AND user_id = ?"
            dup_params = [task_id, user_id]
            if transition_id:
                dup_sql += " AND transition_id = ?"
                dup_params.append(transition_id)
            cursor.execute(dup_sql, dup_params)
            if cursor.fetchone():
                raise ValueError("Вы уже согласовали эту задачу")

            cursor.execute("""
                INSERT INTO Task_Manager.task_approvals (task_id, user_id, comment, transition_id)
                OUTPUT INSERTED.id VALUES (?, ?, ?, ?)
            """, (task_id, user_id, comment, transition_id))
            approval_id = cursor.fetchone()[0]

            cursor.execute("""
                INSERT INTO Task_Manager.task_history
                (task_id, user_id, action_type, field_changed, new_value)
                VALUES (?, ?, 'approval_added', 'approval', ?)
            """, (task_id, user_id, comment or 'Согласовано'))

            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

        # Автоперевод проверяем после закрытия транзакции
        ApprovalsService.check_auto_transition(task_id)
        return approval_id

    @staticmethod
    def remove_approval(task_id: int, user_id: int, transition_id: int = None) -> bool:
        """
        Отозвать согласование.
        Если после отзыва условия перехода не выполнены — задача возвращается
        на transition.from_status_id.
        """
        conn = get_connection()
        cursor = conn.cursor()
        try:
            # Проверка доступа к задаче (и роли viewer)
            cursor.execute("""
                SELECT t.project_id, pm.role
                FROM Task_Manager.tasks t
                INNER JOIN Task_Manager.project_members pm ON t.project_id = pm.project_id
                WHERE t.id = ? AND pm.user_id = ?
            """, (task_id, user_id))
            access_row = cursor.fetchone()
            if not access_row:
                raise PermissionError("Нет доступа к задаче")
            if access_row[1] == 'viewer':
                raise PermissionError("Viewer не может отзывать согласование")

            find_sql = (
                "SELECT id, transition_id FROM Task_Manager.task_approvals "
                "WHERE task_id = ? AND user_id = ?"
            )
            find_params = [task_id, user_id]
            if transition_id:
                find_sql += " AND transition_id = ?"
                find_params.append(transition_id)
            cursor.execute(find_sql, find_params)
            row = cursor.fetchone()
            if not row:
                return False

            approval_id, linked_tid = row

            cursor.execute("DELETE FROM Task_Manager.task_approvals WHERE id = ?", (approval_id,))
            cursor.execute("""
                INSERT INTO Task_Manager.task_history
                (task_id, user_id, action_type, field_changed, new_value)
                VALUES (?, ?, 'approval_removed', 'approval', 'Согласование отозвано')
            """, (task_id, user_id))

            # Проверяем условия и при необходимости откатываем статус
            if linked_tid:
                transition = ApprovalsService._get_transition(cursor, linked_tid)
                if transition and transition['requires_approvals']:
                    if not ApprovalsService._check_conditions_met(cursor, task_id, transition):
                        cursor.execute(
                            "SELECT status_id FROM Task_Manager.tasks WHERE id = ?", (task_id,)
                        )
                        status_row = cursor.fetchone()
                        if status_row:
                            old_status = status_row[0]
                            revert_to = transition['from_status_id']
                            # Откатываем статус только в связных состояниях этого transition:
                            # - если задача в to_status -> возвращаем в from_status
                            # - если уже в from_status -> ничего не делаем
                            # - если задача в любом другом статусе -> не трогаем статус
                            #   (защита от случайных "прыжков" при revoke исторического approve).
                            if old_status == transition['to_status_id']:
                                print(f"[REVOKE] Условия не выполнены — возвращаем задачу {task_id}: "
                                      f"{old_status} → {revert_to}")
                                cursor.execute("""
                                    UPDATE Task_Manager.tasks
                                    SET status_id = ?, updated_at = GETUTCDATE() WHERE id = ?
                                """, (revert_to, task_id))
                                cursor.execute("""
                                    INSERT INTO Task_Manager.task_history
                                    (task_id, user_id, action_type, field_changed, old_value, new_value)
                                    VALUES (?, ?, 'status_reverted', 'status_id', ?, ?)
                                """, (task_id, user_id, str(old_status), str(revert_to)))

            conn.commit()

            return True
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

    @staticmethod
    def check_auto_transition(task_id: int):
        """Автоперевод задачи если все условия выполнены."""
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT status_id, project_id FROM Task_Manager.tasks WHERE id = ?", (task_id,)
            )
            result = cursor.fetchone()
            if not result:
                return
            current_status_id, project_id = result

            cursor.execute("""
                SELECT id, to_status_id, from_status_id,
                       requires_attachment, requires_approvals,
                       required_approvals_count, required_approvers,
                       approval_mode, approver_departments
                FROM Task_Manager.workflow_transitions
                WHERE project_id = ? AND from_status_id = ? AND auto_transition = 1
            """, (project_id, current_status_id))

            for row in cursor.fetchall():
                trans = {
                    'id':                       row[0],
                    'to_status_id':             row[1],
                    'from_status_id':           row[2],
                    'requires_attachment':      bool(row[3]),
                    'requires_approvals':       bool(row[4]),
                    'required_approvals_count': row[5] or 0,
                    'required_approvers':       row[6],
                    'approval_mode':            row[7] or 'count',
                    'approver_departments':     row[8],
                }

                if trans['requires_attachment']:
                    cursor.execute(
                        "SELECT COUNT(*) FROM Task_Manager.task_attachments WHERE task_id = ?",
                        (task_id,)
                    )
                    if cursor.fetchone()[0] == 0:
                        continue

                if trans['requires_approvals']:
                    if not ApprovalsService._check_conditions_met(cursor, task_id, trans):
                        continue

                cursor.execute("""
                    UPDATE Task_Manager.tasks
                    SET status_id = ?, updated_at = GETUTCDATE() WHERE id = ?
                """, (trans['to_status_id'], task_id))
                conn.commit()
                print(f"[AUTO] ✅ Задача {task_id}: {current_status_id} → {trans['to_status_id']}")
                break

        except Exception as e:
            conn.rollback()
            print(f"Ошибка автоперевода: {e}")
        finally:
            cursor.close()
            conn.close()
