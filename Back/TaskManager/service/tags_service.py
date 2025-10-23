"""
Сервис для работы с тегами
"""
from Back.database.db_connector import get_connection
from typing import List, Dict, Optional


class TagsService:
    
    @staticmethod
    def check_project_access(project_id: int, user_id: int) -> bool:
        """
        Проверить доступ к проекту
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 1 FROM Task_Manager.project_members WHERE project_id = ? AND user_id = ?
        """, (project_id, user_id))
        
        has_access = cursor.fetchone() is not None
        
        cursor.close()
        conn.close()
        
        return has_access
    
    @staticmethod
    def get_project_tags(project_id: int, user_id: int) -> List[Dict]:
        """
        Получить все теги проекта
        """
        if not TagsService.check_project_access(project_id, user_id):
            raise PermissionError("Нет доступа к проекту")
        
        conn = get_connection()
        cursor = conn.cursor()
        
        query = """
            SELECT 
                t.id,
                t.project_id,
                t.name,
                t.color,
                t.created_at,
                (SELECT COUNT(*) FROM Task_Manager.task_tags WHERE tag_id = t.id) as usage_count
            FROM Task_Manager.tags t
            WHERE t.project_id = ?
            ORDER BY t.name
        """
        
        cursor.execute(query, (project_id,))
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        
        return results
    
    @staticmethod
    def create_tag(project_id: int, user_id: int, name: str, color: str) -> int:
        """
        Создать новый тег
        """
        if not TagsService.check_project_access(project_id, user_id):
            raise PermissionError("Нет доступа к проекту")
        
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO Task_Manager.tags (project_id, name, color)
                OUTPUT INSERTED.id
                VALUES (?, ?, ?)
            """, (project_id, name, color))
            
            tag_id = cursor.fetchone()[0]
            conn.commit()
            
            return tag_id
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
    
    @staticmethod
    def update_tag(tag_id: int, user_id: int, name: Optional[str] = None,
                  color: Optional[str] = None) -> bool:
        """
        Обновить тег
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Получаем project_id
            cursor.execute("SELECT project_id FROM Task_Manager.tags WHERE id = ?", (tag_id,))
            result = cursor.fetchone()
            
            if not result:
                raise ValueError("Тег не найден")
            
            project_id = result[0]
            
            if not TagsService.check_project_access(project_id, user_id):
                raise PermissionError("Нет доступа к проекту")
            
            updates = []
            params = []
            
            if name is not None:
                updates.append("name = ?")
                params.append(name)
            if color is not None:
                updates.append("color = ?")
                params.append(color)
            
            if updates:
                params.append(tag_id)
                query = f"UPDATE Task_Manager.tags SET {', '.join(updates)} WHERE id = ?"
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
    def delete_tag(tag_id: int, user_id: int) -> bool:
        """
        Удалить тег
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Получаем project_id
            cursor.execute("SELECT project_id FROM Task_Manager.tags WHERE id = ?", (tag_id,))
            result = cursor.fetchone()
            
            if not result:
                raise ValueError("Тег не найден")
            
            project_id = result[0]
            
            if not TagsService.check_project_access(project_id, user_id):
                raise PermissionError("Нет доступа к проекту")
            
            # Удаляем связи с задачами
            cursor.execute("DELETE FROM Task_Manager.task_tags WHERE tag_id = ?", (tag_id,))
            
            # Удаляем тег
            cursor.execute("DELETE FROM Task_Manager.tags WHERE id = ?", (tag_id,))
            
            conn.commit()
            return True
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

