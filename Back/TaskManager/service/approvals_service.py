"""
Сервис для работы с согласованиями задач
"""
from Back.database.db_connector import get_connection
from typing import List, Dict


class ApprovalsService:
    
    @staticmethod
    def get_task_approvals(task_id: int, user_id: int) -> List[Dict]:
        """
        Получить список согласований задачи
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Проверяем доступ к задаче
            cursor.execute("""
                SELECT t.project_id
                FROM Task_Manager.tasks t
                INNER JOIN Task_Manager.project_members pm ON t.project_id = pm.project_id
                WHERE t.id = ? AND pm.user_id = ?
            """, (task_id, user_id))
            
            if not cursor.fetchone():
                raise PermissionError("Нет доступа к задаче")
            
            # Получаем согласования
            cursor.execute("""
                SELECT 
                    ta.id,
                    ta.task_id,
                    ta.user_id,
                    u.Username as username,
                    u.FullName as full_name,
                    ta.approved_at,
                    ta.comment
                FROM Task_Manager.task_approvals ta
                INNER JOIN Users.users u ON ta.user_id = u.UserID
                WHERE ta.task_id = ?
                ORDER BY ta.approved_at DESC
            """, (task_id,))
            
            columns = [column[0] for column in cursor.description]
            results = [dict(zip(columns, row)) for row in cursor.fetchall()]
            
            return results
        finally:
            cursor.close()
            conn.close()
    
    @staticmethod
    def add_approval(task_id: int, user_id: int, comment: str = None) -> int:
        """
        Согласовать задачу
        """
        print(f"[APPROVAL] Добавление согласования: задача {task_id}, пользователь {user_id}")
        
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Проверяем доступ
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
                raise PermissionError("Viewer не может согласовывать задачи")
            
            # Добавляем согласование
            cursor.execute("""
                INSERT INTO Task_Manager.task_approvals (task_id, user_id, comment)
                OUTPUT INSERTED.id
                VALUES (?, ?, ?)
            """, (task_id, user_id, comment))
            
            approval_id = cursor.fetchone()[0]
            conn.commit()
            print(f"[APPROVAL] ✅ Согласование {approval_id} добавлено")
            
            cursor.close()
            conn.close()
            
            # Проверяем автоперевод ПОСЛЕ закрытия транзакции
            print(f"[APPROVAL] Вызываем check_auto_transition для задачи {task_id}")
            ApprovalsService.check_auto_transition(task_id)
            
            return approval_id
        except Exception as e:
            conn.rollback()
            cursor.close()
            conn.close()
            raise e
    
    @staticmethod
    def remove_approval(task_id: int, user_id: int) -> bool:
        """
        Отозвать согласование
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                DELETE FROM Task_Manager.task_approvals
                WHERE task_id = ? AND user_id = ?
            """, (task_id, user_id))
            
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
        """
        Проверить условия автоперевода после согласования
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            print(f"[AUTO] Проверка автоперевода для задачи {task_id}")
            
            # Получаем текущий статус задачи и project_id
            cursor.execute("""
                SELECT status_id, project_id FROM Task_Manager.tasks WHERE id = ?
            """, (task_id,))
            
            result = cursor.fetchone()
            if not result:
                print(f"[AUTO] Задача {task_id} не найдена")
                return
            
            current_status_id, project_id = result
            print(f"[AUTO] Задача в статусе {current_status_id}, проект {project_id}")
            
            # Ищем переходы из текущего статуса с автопереводом
            cursor.execute("""
                SELECT 
                    id, to_status_id, requires_approvals, required_approvals_count, 
                    required_approvers, requires_attachment, auto_transition
                FROM Task_Manager.workflow_transitions
                WHERE project_id = ? AND from_status_id = ? AND auto_transition = 1
            """, (project_id, current_status_id))
            
            transitions = cursor.fetchall()
            print(f"[AUTO] Найдено переходов с автопереводом: {len(transitions)}")
            
            for trans in transitions:
                trans_id, to_status_id, req_approvals, req_count, req_approvers, req_attachment, auto_trans = trans
                print(f"[AUTO] Проверяем переход {trans_id} в статус {to_status_id}")
                
                # Проверяем все условия
                all_conditions_met = True
                
                # 1. Проверка вложения
                if req_attachment:
                    print(f"[AUTO] Требуется вложение")
                    cursor.execute("""
                        SELECT COUNT(*) FROM Task_Manager.task_attachments WHERE task_id = ?
                    """, (task_id,))
                    if cursor.fetchone()[0] == 0:
                        all_conditions_met = False
                        continue
                
                # 2. Проверка согласований
                if req_approvals and req_count > 0:
                    print(f"[AUTO] Требуется {req_count} согласований")
                    cursor.execute("""
                        SELECT user_id FROM Task_Manager.task_approvals WHERE task_id = ?
                    """, (task_id,))
                    approved_users = [row[0] for row in cursor.fetchall()]
                    
                    if req_approvers:
                        import json
                        required_users = json.loads(req_approvers) if isinstance(req_approvers, str) else req_approvers
                        approved_from_pool = [u for u in approved_users if u in required_users]
                        
                        if len(approved_from_pool) < req_count:
                            all_conditions_met = False
                            continue
                    else:
                        if len(approved_users) < req_count:
                            all_conditions_met = False
                            continue
                
                # Все условия выполнены - переводим
                if all_conditions_met:
                    print(f"[AUTO] ✅ Все условия выполнены! Переводим в статус {to_status_id}")
                    
                    # Проверяем текущий статус перед UPDATE
                    cursor.execute("SELECT status_id FROM Task_Manager.tasks WHERE id = ?", (task_id,))
                    before = cursor.fetchone()[0]
                    print(f"[AUTO] Статус ДО: {before}")
                    
                    cursor.execute("""
                        UPDATE Task_Manager.tasks 
                        SET status_id = ?, updated_at = GETDATE()
                        WHERE id = ?
                    """, (to_status_id, task_id))
                    
                    rows_affected = cursor.rowcount
                    print(f"[AUTO] UPDATE затронул строк: {rows_affected}")
                    
                    conn.commit()
                    print(f"[AUTO] COMMIT выполнен")
                    
                    # Проверяем после UPDATE
                    cursor.execute("SELECT status_id FROM Task_Manager.tasks WHERE id = ?", (task_id,))
                    after = cursor.fetchone()[0]
                    print(f"[AUTO] Статус ПОСЛЕ: {after}")
                    
                    print(f"[AUTO] ✅ Автоперевод задачи {task_id}: {before} → {after}")
                    break
                else:
                    print(f"[AUTO] ❌ Не все условия выполнены для перехода {trans_id}")
        except Exception as e:
            conn.rollback()
            print(f"Ошибка автоперевода: {e}")
        finally:
            cursor.close()
            conn.close()

