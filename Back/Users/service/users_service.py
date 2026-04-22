"""
Сервис-слой: работа с данными пользователей
"""

from typing import Optional, Dict, Any
import time
from ...database.db_connector import get_connection
from .skud_service import get_employee_info
from .departments_service import ensure_departments_schema, validate_active_department
from .auth_service import ensure_user_language_schema, normalize_preferred_language

_PROFILE_CACHE_TTL_SEC = 30
_SKUD_CACHE_TTL_SEC = 3600
_profile_cache: Dict[int, Dict[str, Any]] = {}
_skud_cache: Dict[str, Dict[str, Any]] = {}


def _get_cached_profile(user_id: int) -> Optional[Dict[str, Any]]:
    entry = _profile_cache.get(user_id)
    if not entry:
        return None
    if time.time() - entry['ts'] > _PROFILE_CACHE_TTL_SEC:
        _profile_cache.pop(user_id, None)
        return None
    return entry['data']


def _set_cached_profile(user_id: int, data: Dict[str, Any]) -> None:
    _profile_cache[user_id] = {'ts': time.time(), 'data': data}


def _invalidate_profile_cache(user_id: int) -> None:
    _profile_cache.pop(user_id, None)


def _get_cached_skud(empcode: str) -> Optional[Dict[str, Any]]:
    entry = _skud_cache.get(empcode)
    if not entry:
        return None
    if time.time() - entry['ts'] > _SKUD_CACHE_TTL_SEC:
        _skud_cache.pop(empcode, None)
        return None
    return entry['data']


def _set_cached_skud(empcode: str, data: Dict[str, Any]) -> None:
    _skud_cache[empcode] = {'ts': time.time(), 'data': data}


def update_user_profile(
    user_id: int,
    full_name: Optional[str] = None,
    password: Optional[str] = None,
    email: Optional[str] = None,
    department_id: Optional[int] = None,
    preferred_language: Optional[str] = None,
) -> Dict[str, Any]:
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
    
    if email is not None:
        updates.append("Email = ?")
        params.append(email)

    if department_id is not None:
        updates.append("department_id = ?")
        params.append(department_id)

    if preferred_language is not None:
        updates.append("preferred_language = ?")
        params.append(normalize_preferred_language(preferred_language))

    if not updates:
        raise ValueError("Нужно указать хотя бы одно поле для обновления")
    
    params.append(user_id)
    
    sql = f"""
        UPDATE Users.Users
        SET {', '.join(updates)}
        WHERE UserID = ?
    """
    
    ensure_departments_schema()
    ensure_user_language_schema()
    if department_id is not None and not validate_active_department(department_id):
        raise ValueError("Отдел не найден или деактивирован")

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        conn.commit()
        
        # Получаем обновленные данные
        cursor.execute("""
            SELECT
                u.UserID,
                u.Username,
                u.FullName,
                u.Email,
                u.IsAdmin,
                u.department_id,
                u.preferred_language,
                d.Name AS DepartmentName,
                COALESCE(d.NameEn, d.Name) AS DepartmentNameEn,
                d.NameZh AS DepartmentNameZh
            FROM Users.Users u
            LEFT JOIN Users.Departments d ON d.DepartmentID = u.department_id
            WHERE u.UserID = ?
        """, (user_id,))
        
        row = cursor.fetchone()
        
        result = {
            'user_id': row.UserID,
            'username': row.Username,
            'full_name': row.FullName,
            'email': row.Email,
            'department_id': row.department_id,
            'preferred_language': normalize_preferred_language(row.preferred_language),
            'department_name': row.DepartmentName,
            'department_name_en': row.DepartmentNameEn,
            'department_name_zh': row.DepartmentNameZh,
            'is_admin': bool(row.IsAdmin)
        }
        _invalidate_profile_cache(user_id)
        return result


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """
    Получает данные пользователя по ID.
    
    Args:
        user_id: ID пользователя
    
    Returns:
        Данные пользователя или None
    """
    cached = _get_cached_profile(user_id)
    if cached is not None:
        return cached

    ensure_departments_schema()
    ensure_user_language_schema()

    sql = """
        SELECT
            u.UserID,
            u.Username,
            u.FullName,
            u.Email,
            u.IsAdmin,
            u.CreatedAt,
            u.LastLogin,
            u.empcode,
            u.department_id,
            u.preferred_language,
            d.Name AS DepartmentName,
            COALESCE(d.NameEn, d.Name) AS DepartmentNameEn,
            d.NameZh AS DepartmentNameZh
        FROM Users.Users u
        LEFT JOIN Users.Departments d ON d.DepartmentID = u.department_id
        WHERE u.UserID = ?
    """
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, (user_id,))
        row = cursor.fetchone()
        
        if not row:
            return None
        
        # Получаем базовые данные пользователя
        user_data = {
            'user_id': row.UserID,
            'username': row.Username,
            'full_name': row.FullName,
            'email': row.Email,
            'department_id': row.department_id,
            'preferred_language': normalize_preferred_language(row.preferred_language),
            'department_name': row.DepartmentName,
            'department_name_en': row.DepartmentNameEn,
            'department_name_zh': row.DepartmentNameZh,
            'department': row.DepartmentName,
            'is_admin': bool(row.IsAdmin),
            'created_at': row.CreatedAt.isoformat() if row.CreatedAt else None,
            'last_login': row.LastLogin.isoformat() if row.LastLogin else None
        }
        
        # Дополнительные данные из SKUD сохраняем только для даты рождения.
        if row.empcode:
            skud_data = _get_cached_skud(row.empcode)
            if skud_data is None:
                skud_data = get_employee_info(row.empcode)
                if skud_data:
                    _set_cached_skud(row.empcode, skud_data)
            if skud_data:
                user_data.update({
                    'birthday': skud_data.get('birthday')
                })

        _set_cached_profile(user_id, user_data)
        return user_data

