"""
Сервис для работы с комментариями
"""
from Back.database.db_connector import get_connection
from typing import List, Dict, Optional


class CommentsService:
    
    @staticmethod
    def check_task_access(task_id: int, user_id: int) -> bool:
        """
        Проверить доступ к задаче через проект
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 1 
            FROM Task_Manager.tasks t
            INNER JOIN Task_Manager.project_members pm ON t.project_id = pm.project_id
            WHERE t.id = ? AND pm.user_id = ?
        """, (task_id, user_id))
        
        has_access = cursor.fetchone() is not None
        
        cursor.close()
        conn.close()
        
        return has_access
    
    @staticmethod
    def get_task_comments(task_id: int, user_id: int) -> List[Dict]:
        """
        Получить все комментарии задачи
        """
        if not CommentsService.check_task_access(task_id, user_id):
            raise PermissionError("Нет доступа к задаче")
        
        conn = get_connection()
        cursor = conn.cursor()
        
        query = """
            SELECT 
                c.id,
                c.task_id,
                c.user_id,
                u.Username,
                u.FullName,
                c.comment,
                c.created_at,
                c.updated_at
            FROM Task_Manager.task_comments c
            INNER JOIN Users.users u ON c.user_id = u.UserID
            WHERE c.task_id = ?
            ORDER BY c.created_at ASC
        """
        
        cursor.execute(query, (task_id,))
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        
        return results
    
    @staticmethod
    def create_comment(task_id: int, user_id: int, comment: str) -> int:
        """
        Создать комментарий
        """
        if not CommentsService.check_task_access(task_id, user_id):
            raise PermissionError("Нет доступа к задаче")
        
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO Task_Manager.task_comments (task_id, user_id, comment)
                OUTPUT INSERTED.id
                VALUES (?, ?, ?)
            """, (task_id, user_id, comment))
            
            comment_id = cursor.fetchone()[0]
            conn.commit()
            
            return comment_id
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
    
    @staticmethod
    def update_comment(comment_id: int, user_id: int, comment: str) -> bool:
        """
        Обновить комментарий (только автор)
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Проверяем, что пользователь - автор
            cursor.execute("""
                SELECT user_id FROM Task_Manager.task_comments WHERE id = ?
            """, (comment_id,))
            
            result = cursor.fetchone()
            if not result:
                raise ValueError("Комментарий не найден")
            
            if result[0] != user_id:
                raise PermissionError("Можно редактировать только свои комментарии")
            
            cursor.execute("""
                UPDATE Task_Manager.task_comments 
                SET comment = ?, updated_at = GETDATE()
                WHERE id = ?
            """, (comment, comment_id))
            
            conn.commit()
            return True
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
    
    @staticmethod
    def delete_comment(comment_id: int, user_id: int) -> bool:
        """
        Удалить комментарий (автор или admin проекта)
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Получаем информацию о комментарии
            cursor.execute("""
                SELECT c.user_id, t.project_id
                FROM Task_Manager.task_comments c
                INNER JOIN Task_Manager.tasks t ON c.task_id = t.id
                WHERE c.id = ?
            """, (comment_id,))
            
            result = cursor.fetchone()
            if not result:
                raise ValueError("Комментарий не найден")
            
            comment_user_id, project_id = result
            
            # Проверяем права (автор или admin/owner проекта)
            if comment_user_id != user_id:
                cursor.execute("""
                    SELECT role FROM Task_Manager.project_members
                    WHERE project_id = ? AND user_id = ?
                """, (project_id, user_id))
                
                role_result = cursor.fetchone()
                if not role_result or role_result[0] not in ('owner', 'admin'):
                    raise PermissionError("Можно удалять только свои комментарии")
            
            cursor.execute("DELETE FROM Task_Manager.task_comments WHERE id = ?", (comment_id,))
            conn.commit()
            
            return True
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

