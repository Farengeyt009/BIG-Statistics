"""
Сервис-слой: работа с данными пользователей
"""

from typing import Optional, Dict, Any
from ...database.db_connector import get_connection


def update_user_profile(user_id: int, full_name: Optional[str] = None, password: Optional[str] = None) -> Dict[str, Any]:
    """
    Обновляет профиль пользователя (имя и/или пароль).
    
    Args:
        user_id: ID пользователя
        full_name: Новое полное имя (опционально)
        password: Новый пароль (опционально)
    
    Returns:
        Обновленные данные пользователя
    """
    updates = []
    params = []
    
    if full_name is not None:
        updates.append("FullName = ?")
        params.append(full_name)
    
    if password is not None:
        updates.append("Password = ?")
        params.append(password)
    
    if not updates:
        raise ValueError("Нужно указать хотя бы одно поле для обновления")
    
    params.append(user_id)
    
    sql = f"""
        UPDATE Users.Users
        SET {', '.join(updates)}
        WHERE UserID = ?
    """
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        conn.commit()
        
        # Получаем обновленные данные
        cursor.execute("""
            SELECT UserID, Username, FullName, Email, IsAdmin
            FROM Users.Users
            WHERE UserID = ?
        """, (user_id,))
        
        row = cursor.fetchone()
        
        return {
            'user_id': row.UserID,
            'username': row.Username,
            'full_name': row.FullName,
            'email': row.Email,
            'is_admin': bool(row.IsAdmin)
        }


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """
    Получает данные пользователя по ID.
    
    Args:
        user_id: ID пользователя
    
    Returns:
        Данные пользователя или None
    """
    sql = """
        SELECT UserID, Username, FullName, Email, IsAdmin, CreatedAt, LastLogin
        FROM Users.Users
        WHERE UserID = ?
    """
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, (user_id,))
        row = cursor.fetchone()
        
        if not row:
            return None
        
        return {
            'user_id': row.UserID,
            'username': row.Username,
            'full_name': row.FullName,
            'email': row.Email,
            'is_admin': bool(row.IsAdmin),
            'created_at': row.CreatedAt.isoformat() if row.CreatedAt else None,
            'last_login': row.LastLogin.isoformat() if row.LastLogin else None
        }

