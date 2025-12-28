"""
Service for logging user actions (audit log)
"""

from datetime import datetime
from ...database.db_connector import get_connection


def log_action(
    user_id: int,
    action_type: str,
    page_key: str = None,
    action_details: str = None,
    ip_address: str = None,
    user_agent: str = None
):
    """
    Логирует действие пользователя в таблицу Users.AuditLog
    
    Args:
        user_id: ID пользователя
        action_type: Тип действия ('login', 'logout', 'page_view', 'data_edit', 'permission_change')
        page_key: Ключ страницы (опционально)
        action_details: Дополнительные детали в формате JSON (опционально)
        ip_address: IP адрес (опционально)
        user_agent: User Agent браузера (опционально)
    """
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            
            # Защита от дублирования session_start: проверяем была ли запись в последние 30 секунд
            if action_type == 'session_start':
                cursor.execute("""
                    SELECT TOP 1 LogID
                    FROM Users.AuditLog
                    WHERE UserID = ? 
                      AND ActionType IN ('session_start', 'login')
                      AND CreatedAt >= DATEADD(second, -30, GETDATE())
                """, (user_id,))
                
                recent_session = cursor.fetchone()
                if recent_session:
                    # Уже есть запись session_start или login меньше 30 секунд назад - не дублируем
                    return True
            
            # Защита от дублирования page_view: проверяем было ли посещение ЭТОЙ страницы в последние 30 секунд
            if action_type == 'page_view' and page_key:
                cursor.execute("""
                    SELECT TOP 1 LogID
                    FROM Users.AuditLog
                    WHERE UserID = ? 
                      AND ActionType = 'page_view'
                      AND PageKey = ?
                      AND CreatedAt >= DATEADD(second, -30, GETDATE())
                """, (user_id, page_key))
                
                recent_view = cursor.fetchone()
                if recent_view:
                    # Уже есть посещение этой страницы меньше 30 секунд назад - не дублируем
                    return True
            
            cursor.execute("""
                INSERT INTO Users.AuditLog 
                (UserID, ActionType, PageKey, ActionDetails, IPAddress, UserAgent, CreatedAt)
                VALUES (?, ?, ?, ?, ?, ?, GETDATE())
            """, (user_id, action_type, page_key, action_details, ip_address, user_agent))
            
            conn.commit()
            return True
            
    except Exception as e:
        print(f"Error logging action: {str(e)}")
        return False


def get_user_statistics(user_id: int):
    """
    Получает статистику по пользователю
    
    Returns:
        {
            'total_logins': int,
            'last_login': datetime,
            'most_visited_page': str,
            'total_actions': int
        }
    """
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            
            # Общее количество входов (login + session_start)
            cursor.execute("""
                SELECT COUNT(*) as total_logins
                FROM Users.AuditLog
                WHERE UserID = ? AND ActionType IN ('login', 'session_start')
            """, (user_id,))
            total_logins = cursor.fetchone().total_logins or 0
            
            # Последний вход (из таблицы Users)
            cursor.execute("""
                SELECT LastLogin
                FROM Users.Users
                WHERE UserID = ?
            """, (user_id,))
            row = cursor.fetchone()
            last_login = row.LastLogin if row else None
            
            # Самая посещаемая страница
            cursor.execute("""
                SELECT TOP 1 PageKey, COUNT(*) as visits
                FROM Users.AuditLog
                WHERE UserID = ? AND PageKey IS NOT NULL
                GROUP BY PageKey
                ORDER BY COUNT(*) DESC
            """, (user_id,))
            most_visited_row = cursor.fetchone()
            most_visited_page = most_visited_row.PageKey if most_visited_row else None
            
            # Общее количество действий
            cursor.execute("""
                SELECT COUNT(*) as total_actions
                FROM Users.AuditLog
                WHERE UserID = ?
            """, (user_id,))
            total_actions = cursor.fetchone().total_actions or 0
            
            return {
                'total_logins': total_logins,
                'last_login': last_login.isoformat() if last_login else None,
                'most_visited_page': most_visited_page,
                'total_actions': total_actions
            }
            
    except Exception as e:
        print(f"Error getting user statistics: {str(e)}")
        return None


def get_system_statistics():
    """
    Получает общую статистику системы
    
    Returns:
        {
            'total_users': int,
            'total_admins': int,
            'active_users': int,
            'inactive_users': int,
            'new_users_7days': int,
            'logged_in_today': int,
            'top_active_users': [...],
            'popular_pages': [...],
            'all_users_activity': [...]  # Новое поле
        }
    """
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            
            # Всего пользователей
            cursor.execute("SELECT COUNT(*) as cnt FROM Users.Users")
            total_users = cursor.fetchone().cnt or 0
            
            # Администраторов
            cursor.execute("SELECT COUNT(*) as cnt FROM Users.Users WHERE IsAdmin = 1")
            total_admins = cursor.fetchone().cnt or 0
            
            # Активных
            cursor.execute("SELECT COUNT(*) as cnt FROM Users.Users WHERE IsActive = 1")
            active_users = cursor.fetchone().cnt or 0
            
            # Неактивных
            inactive_users = total_users - active_users
            
            # Новых за 7 дней
            cursor.execute("""
                SELECT COUNT(*) as cnt 
                FROM Users.Users 
                WHERE CreatedAt >= DATEADD(day, -7, GETDATE())
            """)
            new_users_7days = cursor.fetchone().cnt or 0
            
            # Заходили сегодня
            cursor.execute("""
                SELECT COUNT(*) as cnt 
                FROM Users.Users 
                WHERE CAST(LastLogin AS DATE) = CAST(GETDATE() AS DATE)
            """)
            logged_in_today = cursor.fetchone().cnt or 0
            
            # Топ активных пользователей (за последние 7 дней) - учитываем login и session_start
            cursor.execute("""
                SELECT TOP 5
                    u.UserID,
                    u.Username,
                    u.FullName,
                    COUNT(*) as login_count
                FROM Users.AuditLog a
                JOIN Users.Users u ON a.UserID = u.UserID
                WHERE a.ActionType IN ('login', 'session_start')
                  AND a.CreatedAt >= DATEADD(day, -7, GETDATE())
                GROUP BY u.UserID, u.Username, u.FullName
                ORDER BY COUNT(*) DESC
            """)
            
            top_active_users = []
            for row in cursor.fetchall():
                top_active_users.append({
                    'user_id': row.UserID,
                    'username': row.Username,
                    'full_name': row.FullName,
                    'login_count': row.login_count
                })
            
            # Популярные страницы (за последние 30 дней)
            cursor.execute("""
                SELECT TOP 10
                    PageKey,
                    COUNT(*) as visit_count
                FROM Users.AuditLog
                WHERE PageKey IS NOT NULL
                  AND CreatedAt >= DATEADD(day, -30, GETDATE())
                GROUP BY PageKey
                ORDER BY COUNT(*) DESC
            """)
            
            popular_pages = []
            for row in cursor.fetchall():
                popular_pages.append({
                    'page_key': row.PageKey,
                    'visit_count': row.visit_count
                })
            
            # Детальная активность всех пользователей
            cursor.execute("""
                SELECT 
                    u.UserID,
                    u.Username,
                    u.FullName,
                    u.IsAdmin,
                    u.IsActive,
                    u.LastLogin,
                    (SELECT COUNT(*) 
                     FROM Users.AuditLog a 
                     WHERE a.UserID = u.UserID 
                       AND a.ActionType IN ('login', 'session_start')) as total_visits,
                    (SELECT MAX(a.CreatedAt) 
                     FROM Users.AuditLog a 
                     WHERE a.UserID = u.UserID) as last_activity
                FROM Users.Users u
                ORDER BY last_activity DESC
            """)
            
            all_users_activity = []
            for row in cursor.fetchall():
                all_users_activity.append({
                    'user_id': row.UserID,
                    'username': row.Username,
                    'full_name': row.FullName,
                    'is_admin': bool(row.IsAdmin),
                    'is_active': bool(row.IsActive),
                    'last_login': row.LastLogin.isoformat() if row.LastLogin else None,
                    'total_visits': row.total_visits or 0,
                    'last_activity': row.last_activity.isoformat() if row.last_activity else None
                })
            
            return {
                'total_users': total_users,
                'total_admins': total_admins,
                'active_users': active_users,
                'inactive_users': inactive_users,
                'new_users_7days': new_users_7days,
                'logged_in_today': logged_in_today,
                'top_active_users': top_active_users,
                'popular_pages': popular_pages,
                'all_users_activity': all_users_activity
            }
            
    except Exception as e:
        print(f"Error getting system statistics: {str(e)}")
        return None


def get_user_activity_log(user_id: int, limit: int = 50):
    """
    Получает лог активности пользователя
    
    Args:
        user_id: ID пользователя
        limit: Максимальное количество записей (по умолчанию 50)
    
    Returns:
        Список действий пользователя
    """
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute(f"""
                SELECT TOP {limit}
                    LogID,
                    ActionType,
                    PageKey,
                    ActionDetails,
                    IPAddress,
                    CreatedAt
                FROM Users.AuditLog
                WHERE UserID = ?
                ORDER BY CreatedAt DESC
            """, (user_id,))
            
            logs = []
            for row in cursor.fetchall():
                logs.append({
                    'log_id': row.LogID,
                    'action_type': row.ActionType,
                    'page_key': row.PageKey,
                    'action_details': row.ActionDetails,
                    'ip_address': row.IPAddress,
                    'created_at': row.CreatedAt.isoformat() if row.CreatedAt else None
                })
            
            return logs
            
    except Exception as e:
        print(f"Error getting user activity log: {str(e)}")
        return []

