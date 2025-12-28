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
JWT_EXPIRATION_HOURS = 24 * 30  # Токен действителен 30 дней
# JWT_EXPIRATION_HOURS = 0.0167  # ⚠️ ТЕСТИРОВАНИЕ: 1 минута (раскомментируйте для теста)


def verify_login(login: str, password: str) -> Optional[Dict[str, Any]]:
    """
    Проверяет логин и пароль пользователя.
    Поддерживает вход по Username ИЛИ empcode.
    
    Args:
        login: Username или empcode
        password: Пароль
    
    Returns:
        Dict с данными пользователя или None если логин/пароль неверные
    """
    sql = """
        SELECT 
            UserID,
            Username,
            empcode,
            FullName,
            Email,
            IsAdmin,
            IsActive
        FROM Users.Users
        WHERE (Username = ? OR empcode = ?) AND Password = ?
    """
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, (login, login, password))
        row = cursor.fetchone()
        
        if not row:
            return None
        
        # Проверяем что пользователь активен
        user_data = {
            'UserID': row.UserID,
            'Username': row.Username,
            'empcode': row.empcode,
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


def check_username_available(username: str) -> bool:
    """
    Проверяет доступность username (не занят ли другим пользователем)
    
    Args:
        username: Желаемый username
        
    Returns:
        True если доступен, False если занят
    """
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT UserID 
                FROM Users.Users 
                WHERE Username = ?
            """, (username,))
            
            row = cursor.fetchone()
            
            # Если не найдено - username свободен
            return row is None
            
    except Exception as e:
        print(f"Error checking username availability: {str(e)}")
        return False


def register_user(empcode: str, username: str, password: str, full_name: str, email: str = None) -> Optional[Dict[str, Any]]:
    """
    Регистрирует нового пользователя
    
    Args:
        empcode: Код сотрудника из СКУД
        username: Желаемый username (уникальный, минимум 2 символа)
        password: Пароль (минимум 6 символов)
        full_name: Полное имя из СКУД
        email: Email (опционально)
        
    Returns:
        Dict с данными созданного пользователя или None в случае ошибки
    """
    try:
        # Валидация username (минимум 2 символа, поддержка Unicode/китайских иероглифов)
        if not username or len(username) < 2:
            raise ValueError("Username must be at least 2 characters")
        
        # Валидация пароля (минимум 6 символов)
        if not password or len(password) < 6:
            raise ValueError("Password must be at least 6 characters")
        
        with get_connection() as conn:
            cursor = conn.cursor()
            
            # Проверяем что username свободен
            if not check_username_available(username):
                raise ValueError("Username already taken")
            
            # Проверяем что empcode еще не зарегистрирован
            cursor.execute("""
                SELECT UserID 
                FROM Users.Users 
                WHERE empcode = ?
            """, (empcode,))
            
            if cursor.fetchone():
                raise ValueError("This empcode is already registered")
            
            # Создаем пользователя
            cursor.execute("""
                INSERT INTO Users.Users 
                (Username, empcode, Password, FullName, Email, IsAdmin, IsActive, CreatedAt)
                VALUES (?, ?, ?, ?, ?, 0, 1, GETDATE())
            """, (username, empcode, password, full_name, email))
            
            conn.commit()
            
            # Получаем ID созданного пользователя
            cursor.execute("SELECT @@IDENTITY AS UserID")
            user_id_row = cursor.fetchone()
            user_id = int(user_id_row.UserID) if user_id_row.UserID else None
            
            # Возвращаем данные пользователя
            return {
                'UserID': user_id,
                'Username': str(username),
                'empcode': str(empcode),
                'FullName': str(full_name),
                'Email': str(email) if email else None,
                'IsAdmin': False,
                'IsActive': True
            }
            
    except Exception as e:
        print(f"Error registering user: {str(e)}")
        return None

