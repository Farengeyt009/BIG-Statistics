"""
Сервис для работы с вложениями
"""
from Back.database.db_connector import get_connection
from typing import List, Dict, Optional
import os
from pathlib import Path


class AttachmentsService:
    
    UPLOAD_DIR = Path("uploads/task_attachments")
    
    @staticmethod
    def get_project_folder(task_id: int) -> Path:
        """
        Получить папку проекта для задачи и создать если не существует
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        # Получаем название проекта через задачу
        cursor.execute("""
            SELECT p.id, p.name
            FROM Task_Manager.tasks t
            INNER JOIN Task_Manager.projects p ON t.project_id = p.id
            WHERE t.id = ?
        """, (task_id,))
        
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not result:
            # Fallback на общую папку
            folder = AttachmentsService.UPLOAD_DIR
        else:
            project_id, project_name = result
            # Очищаем название проекта от недопустимых символов для Windows
            safe_name = "".join(c for c in project_name if c not in r'\/:*?"<>|').strip()
            if not safe_name:
                safe_name = f"Project_{project_id}"
            
            folder = AttachmentsService.UPLOAD_DIR / safe_name
        
        # Создаем папку если не существует
        folder.mkdir(parents=True, exist_ok=True)
        return folder
    
    @staticmethod
    def ensure_upload_dir():
        """
        Создать директорию для загрузок, если не существует
        """
        AttachmentsService.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    
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
    def get_task_attachments(task_id: int, user_id: int) -> List[Dict]:
        """
        Получить все вложения задачи
        """
        if not AttachmentsService.check_task_access(task_id, user_id):
            raise PermissionError("Нет доступа к задаче")
        
        conn = get_connection()
        cursor = conn.cursor()
        
        query = """
            SELECT 
                a.id,
                a.task_id,
                a.file_name,
                a.file_path,
                a.file_size,
                a.mime_type,
                a.uploaded_by,
                u.Username as uploaded_by_name,
                a.uploaded_at
            FROM Task_Manager.task_attachments a
            INNER JOIN Users.users u ON a.uploaded_by = u.UserID
            WHERE a.task_id = ?
            ORDER BY a.uploaded_at DESC
        """
        
        cursor.execute(query, (task_id,))
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        
        return results
    
    @staticmethod
    def create_attachment(task_id: int, user_id: int, file_name: str, 
                         file_path: str, file_size: int, mime_type: str) -> int:
        """
        Создать запись о вложении
        """
        if not AttachmentsService.check_task_access(task_id, user_id):
            raise PermissionError("Нет доступа к задаче")
        
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO Task_Manager.task_attachments 
                (task_id, file_name, file_path, file_size, mime_type, uploaded_by)
                OUTPUT INSERTED.id
                VALUES (?, ?, ?, ?, ?, ?)
            """, (task_id, file_name, file_path, file_size, mime_type, user_id))
            
            attachment_id = cursor.fetchone()[0]
            conn.commit()
            
            return attachment_id
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
    
    @staticmethod
    def get_attachment_by_id(attachment_id: int, user_id: int) -> Optional[Dict]:
        """
        Получить вложение по ID
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        query = """
            SELECT 
                a.id,
                a.task_id,
                a.file_name,
                a.file_path,
                a.file_size,
                a.mime_type,
                a.uploaded_by,
                a.uploaded_at
            FROM Task_Manager.task_attachments a
            WHERE a.id = ?
        """
        
        cursor.execute(query, (attachment_id,))
        columns = [column[0] for column in cursor.description]
        row = cursor.fetchone()
        
        if not row:
            cursor.close()
            conn.close()
            return None
        
        attachment = dict(zip(columns, row))
        
        # Проверяем доступ
        if not AttachmentsService.check_task_access(attachment['task_id'], user_id):
            cursor.close()
            conn.close()
            raise PermissionError("Нет доступа к задаче")
        
        cursor.close()
        conn.close()
        
        return attachment
    
    @staticmethod
    def get_project_attachments(project_id: int, user_id: int) -> List[Dict]:
        """
        Получить все вложения проекта
        """
        # Проверяем доступ к проекту
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 1 
            FROM Task_Manager.project_members pm
            WHERE pm.project_id = ? AND pm.user_id = ?
        """, (project_id, user_id))
        
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            raise PermissionError("Нет доступа к проекту")
        
        # Получаем все вложения проекта
        query = """
            SELECT 
                a.id,
                a.task_id,
                a.file_name,
                a.file_path,
                a.file_size,
                a.mime_type,
                a.uploaded_by,
                u.Username as uploaded_by_name,
                a.uploaded_at,
                t.title as task_title,
                t.id as task_id,
                t.created_at as task_created_at
            FROM Task_Manager.task_attachments a
            INNER JOIN Task_Manager.tasks t ON a.task_id = t.id
            INNER JOIN Users.users u ON a.uploaded_by = u.UserID
            WHERE t.project_id = ?
            ORDER BY a.uploaded_at DESC
        """
        
        cursor.execute(query, (project_id,))
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        
        return results
    
    @staticmethod
    def delete_attachment(attachment_id: int, user_id: int) -> bool:
        """
        Удалить вложение (автор или admin проекта)
        """
        conn = get_connection()
        cursor = conn.cursor()
        
        try:
            # Получаем информацию о вложении
            cursor.execute("""
                SELECT a.uploaded_by, a.file_path, t.project_id
                FROM Task_Manager.task_attachments a
                INNER JOIN Task_Manager.tasks t ON a.task_id = t.id
                WHERE a.id = ?
            """, (attachment_id,))
            
            result = cursor.fetchone()
            if not result:
                raise ValueError("Вложение не найдено")
            
            uploaded_by, file_path, project_id = result
            
            # Проверяем права (автор или admin/owner проекта)
            if uploaded_by != user_id:
                cursor.execute("""
                    SELECT role FROM Task_Manager.project_members
                    WHERE project_id = ? AND user_id = ?
                """, (project_id, user_id))
                
                role_result = cursor.fetchone()
                if not role_result or role_result[0] not in ('owner', 'admin'):
                    raise PermissionError("Можно удалять только свои файлы")
            
            # Удаляем запись из БД
            cursor.execute("DELETE FROM Task_Manager.task_attachments WHERE id = ?", (attachment_id,))
            conn.commit()
            
            # Удаляем файл с диска
            try:
                file_full_path = Path(file_path)
                if file_full_path.exists():
                    file_full_path.unlink()
            except Exception as e:
                print(f"Ошибка при удалении файла: {e}")
            
            return True
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()

