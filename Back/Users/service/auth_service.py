"""
Сервис-слой: авторизация и работа с пользователями
"""

import jwt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from ...database.db_connector import get_connection


# Секретный ключ для JWT (в продакшене должен быть в .env)
JWT_SECRET = "your-secret-key-change-in-production"
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24  # Токен действителен 24 часа


def verify_login(username: str, password: str) -> Optional[Dict[str, Any]]:
    """
    Проверяет логин и пароль пользователя.
    
    Returns:
        Dict с данными пользователя или None если логин/пароль неверные
    """
    sql = """
        SELECT 
            UserID,
            Username,
            FullName,
            Email,
            IsAdmin,
            IsActive
        FROM Users.Users
        WHERE Username = ? AND Password = ?
    """
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, (username, password))
        row = cursor.fetchone()
        
        if not row:
            return None
        
        # Проверяем что пользователь активен
        user_data = {
            'UserID': row.UserID,
            'Username': row.Username,
            'FullName': row.FullName,
            'Email': row.Email,
            'IsAdmin': bool(row.IsAdmin),
            'IsActive': bool(row.IsActive)
        }
        
        if not user_data['IsActive']:
            return None
        
        # Обновляем время последнего входа
        update_last_login(user_data['UserID'])
        
        return user_data


def update_last_login(user_id: int):
    """Обновляет время последнего входа пользователя"""
    sql = """
        UPDATE Users.Users
        SET LastLogin = GETDATE()
        WHERE UserID = ?
    """
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, (user_id,))
        conn.commit()


def generate_jwt_token(user_data: Dict[str, Any]) -> str:
    """
    Генерирует JWT токен для пользователя.
    
    Args:
        user_data: Словарь с данными пользователя (UserID, Username, IsAdmin)
    
    Returns:
        JWT токен (строка)
    """
    payload = {
        'user_id': user_data['UserID'],
        'username': user_data['Username'],
        'is_admin': user_data['IsAdmin'],
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
        'iat': datetime.utcnow()
    }
    
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token


def verify_jwt_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Проверяет JWT токен и возвращает данные пользователя.
    
    Args:
        token: JWT токен
    
    Returns:
        Словарь с данными пользователя или None если токен невалидный
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {
            'user_id': payload['user_id'],
            'username': payload['username'],
            'is_admin': payload['is_admin']
        }
    except jwt.ExpiredSignatureError:
        return None  # Токен истёк
    except jwt.InvalidTokenError:
        return None  # Невалидный токен


def get_user_permissions(user_id: int) -> List[Dict[str, Any]]:
    """
    Получает список прав пользователя.
    
    Args:
        user_id: ID пользователя
    
    Returns:
        Список прав: [{'page_key': 'kpi', 'can_view': True, 'can_edit': False}, ...]
    """
    sql = """
        SELECT 
            PageKey,
            CanView,
            CanEdit
        FROM Users.UserPagePermissions
        WHERE UserID = ?
    """
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, (user_id,))
        
        permissions = []
        for row in cursor.fetchall():
            permissions.append({
                'page_key': row.PageKey,
                'can_view': bool(row.CanView),
                'can_edit': bool(row.CanEdit)
            })
        
        return permissions


def check_page_permission(user_id: int, page_key: str, permission_type: str = 'view') -> bool:
    """
    Проверяет право пользователя на страницу.
    
    Args:
        user_id: ID пользователя
        page_key: Ключ страницы (например 'kpi', 'production')
        permission_type: Тип права ('view' или 'edit')
    
    Returns:
        True если есть право, False если нет
    """
    # Проверяем: это админ?
    sql_admin = "SELECT IsAdmin FROM Users.Users WHERE UserID = ?"
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql_admin, (user_id,))
        row = cursor.fetchone()
        
        if row and row.IsAdmin:
            return True  # Админ может всё
        
        # Проверяем: страница есть в справочнике?
        sql_page = """
            SELECT RequiresViewPermission, RequiresEditPermission
            FROM Users.Pages
            WHERE PageKey = ?
        """
        cursor.execute(sql_page, (page_key,))
        page_row = cursor.fetchone()
        
        if not page_row:
            # Страницы нет в справочнике = обычная страница, все видят
            return True
        
        # Страница есть в справочнике - проверяем права
        if permission_type == 'view':
            if not page_row.RequiresViewPermission:
                return True  # Страница не требует права на просмотр
            
            # Требует право - проверяем CanView
            sql_perm = """
                SELECT CanView
                FROM Users.UserPagePermissions
                WHERE UserID = ? AND PageKey = ?
            """
            cursor.execute(sql_perm, (user_id, page_key))
            perm_row = cursor.fetchone()
            
            return bool(perm_row and perm_row.CanView)
        
        elif permission_type == 'edit':
            if not page_row.RequiresEditPermission:
                return False  # Страница не поддерживает редактирование
            
            # Требует право - проверяем CanEdit
            sql_perm = """
                SELECT CanEdit
                FROM Users.UserPagePermissions
                WHERE UserID = ? AND PageKey = ?
            """
            cursor.execute(sql_perm, (user_id, page_key))
            perm_row = cursor.fetchone()
            
            return bool(perm_row and perm_row.CanEdit)
        
        return False

