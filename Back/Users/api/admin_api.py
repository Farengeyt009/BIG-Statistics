"""
Flask API: Administration - managing users and permissions
"""

from flask import Blueprint, jsonify, request
from ..service.auth_service import verify_jwt_token
from ..service.audit_service import get_system_statistics, get_user_statistics, get_user_activity_log
from ...database.db_connector import get_connection
from ..service.departments_service import assign_user_department, ensure_departments_schema
import time

bp = Blueprint("admin", __name__, url_prefix="/api/admin")

_ADMIN_USERS_CACHE_TTL_SEC = 60
_admin_users_cache = {"ts": 0.0, "users": None}


def _get_cached_admin_users():
    users = _admin_users_cache.get("users")
    if users is None:
        return None
    if time.time() - float(_admin_users_cache.get("ts", 0.0)) > _ADMIN_USERS_CACHE_TTL_SEC:
        _admin_users_cache["users"] = None
        return None
    return users


def _set_cached_admin_users(users):
    _admin_users_cache["users"] = users
    _admin_users_cache["ts"] = time.time()


def _invalidate_admin_users_cache():
    _admin_users_cache["users"] = None
    _admin_users_cache["ts"] = 0.0


def require_admin(f):
    """Decorator to require admin privileges"""
    from functools import wraps
    
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"success": False, "error": "Token not provided"}), 401
        
        token = auth_header.split(' ')[1]
        user_data = verify_jwt_token(token)
        
        if not user_data:
            return jsonify({"success": False, "error": "Invalid token"}), 401
        
        if not user_data.get('is_admin'):
            return jsonify({"success": False, "error": "Access denied. Admin privileges required"}), 403
        
        return f(*args, **kwargs)
    
    return decorated_function


@bp.route("/users", methods=["GET"])
@require_admin
def get_all_users():
    """
    GET /api/admin/users
    
    Returns list of all users
    """
    try:
        cached_users = _get_cached_admin_users()
        if cached_users is not None:
            return jsonify({"success": True, "users": cached_users}), 200

        ensure_departments_schema()
        sql = """
            SELECT 
                u.UserID,
                u.Username,
                u.FullName,
                u.Email,
                u.IsAdmin,
                u.IsActive,
                u.CreatedAt,
                u.LastLogin,
                u.department_id,
                d.Name AS DepartmentName,
                COALESCE(d.NameEn, d.Name) AS DepartmentNameEn,
                d.NameZh AS DepartmentNameZh,
                sk.isactive AS HrIsActive
            FROM Users.Users u
            LEFT JOIN Users.Departments d ON d.DepartmentID = u.department_id
            LEFT JOIN Import_SKUD.empinfo sk ON sk.empcode = u.empcode
            ORDER BY u.Username
        """
        
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql)
            
            users = []
            for row in cursor.fetchall():
                users.append({
                    'user_id': row.UserID,
                    'username': row.Username,
                    'full_name': row.FullName,
                    'email': row.Email,
                    'is_admin': bool(row.IsAdmin),
                    'is_active': bool(row.IsActive),
                    'department_id': row.department_id,
                    'department_name': row.DepartmentName,
                    'department_name_en': row.DepartmentNameEn,
                    'department_name_zh': row.DepartmentNameZh,
                    'hr_is_active': bool(row.HrIsActive) if row.HrIsActive is not None else None,
                    'created_at': row.CreatedAt.isoformat() if row.CreatedAt else None,
                    'last_login': row.LastLogin.isoformat() if row.LastLogin else None
                })
            _set_cached_admin_users(users)
            return jsonify({"success": True, "users": users}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


@bp.route("/pages", methods=["GET"])
@require_admin
def get_all_pages():
    """
    GET /api/admin/pages
    
    Returns list of all pages that require permissions
    """
    try:
        sql = """
            SELECT 
                PageID,
                PageKey,
                PageName,
                Description,
                RequiresViewPermission,
                RequiresEditPermission,
                DisplayOrder
            FROM Users.Pages
            ORDER BY DisplayOrder, PageName
        """
        
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql)
            
            pages = []
            for row in cursor.fetchall():
                pages.append({
                    'page_id': row.PageID,
                    'page_key': row.PageKey,
                    'page_name': row.PageName,
                    'description': row.Description,
                    'requires_view_permission': bool(row.RequiresViewPermission),
                    'requires_edit_permission': bool(row.RequiresEditPermission),
                    'display_order': row.DisplayOrder
                })
            
            return jsonify({"success": True, "pages": pages}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


@bp.route("/users/<int:user_id>/permissions", methods=["GET"])
@require_admin
def get_user_permissions(user_id: int):
    """
    GET /api/admin/users/{user_id}/permissions
    
    Returns permissions for specific user
    """
    try:
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
            
            return jsonify({"success": True, "permissions": permissions}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


@bp.route("/users/<int:user_id>/permissions", methods=["PUT"])
@require_admin
def update_user_permissions(user_id: int):
    """
    PUT /api/admin/users/{user_id}/permissions
    
    Body: {
        "page_key": "kpi",
        "can_view": true,
        "can_edit": false
    }
    
    Updates or creates permission for user
    """
    try:
        data = request.get_json()
        page_key = data.get('page_key')
        can_view = data.get('can_view', False)
        can_edit = data.get('can_edit', False)
        
        if not page_key:
            return jsonify({"success": False, "error": "page_key is required"}), 400
        
        with get_connection() as conn:
            cursor = conn.cursor()
            
            # Check if permission exists
            cursor.execute("""
                SELECT PermissionID FROM Users.UserPagePermissions
                WHERE UserID = ? AND PageKey = ?
            """, (user_id, page_key))
            
            existing = cursor.fetchone()
            
            if existing:
                # Update existing
                cursor.execute("""
                    UPDATE Users.UserPagePermissions
                    SET CanView = ?, CanEdit = ?
                    WHERE UserID = ? AND PageKey = ?
                """, (can_view, can_edit, user_id, page_key))
            else:
                # Insert new
                cursor.execute("""
                    INSERT INTO Users.UserPagePermissions (UserID, PageKey, CanView, CanEdit)
                    VALUES (?, ?, ?, ?)
                """, (user_id, page_key, can_view, can_edit))
            
            conn.commit()
            _invalidate_admin_users_cache()
            
            return jsonify({"success": True, "message": "Permission updated successfully"}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


@bp.route("/users/<int:user_id>/permissions/<page_key>", methods=["DELETE"])
@require_admin
def delete_user_permission(user_id: int, page_key: str):
    """
    DELETE /api/admin/users/{user_id}/permissions/{page_key}
    
    Removes permission for user
    """
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                DELETE FROM Users.UserPagePermissions
                WHERE UserID = ? AND PageKey = ?
            """, (user_id, page_key))
            
            conn.commit()
            _invalidate_admin_users_cache()
            
            return jsonify({"success": True, "message": "Permission removed successfully"}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


@bp.route("/users/<int:user_id>/admin", methods=["PUT"])
@require_admin
def update_user_admin_status(user_id: int):
    """
    PUT /api/admin/users/{user_id}/admin
    
    Body: {
        "is_admin": true/false
    }
    
    Updates IsAdmin flag for user
    """
    try:
        data = request.get_json()
        is_admin = data.get('is_admin', False)
        
        with get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                UPDATE Users.Users
                SET IsAdmin = ?
                WHERE UserID = ?
            """, (is_admin, user_id))
            
            conn.commit()
            _invalidate_admin_users_cache()
            
            return jsonify({"success": True, "message": "Admin status updated successfully"}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


@bp.route("/users/<int:user_id>/password", methods=["PUT"])
@require_admin
def update_user_password(user_id: int):
    """
    PUT /api/admin/users/{user_id}/password
    
    Body: {
        "new_password": "новый_пароль"
    }
    
    Updates password for user
    """
    try:
        data = request.get_json()
        new_password = data.get('new_password')
        
        if not new_password:
            return jsonify({"success": False, "error": "New password is required"}), 400
        
        if len(new_password) < 6:
            return jsonify({"success": False, "error": "Password must be at least 6 characters"}), 400
        
        with get_connection() as conn:
            cursor = conn.cursor()
            
            # Проверяем что пользователь существует
            cursor.execute("""
                SELECT Username FROM Users.Users
                WHERE UserID = ?
            """, (user_id,))
            
            user = cursor.fetchone()
            if not user:
                return jsonify({"success": False, "error": "User not found"}), 404
            
            # Обновляем пароль
            cursor.execute("""
                UPDATE Users.Users
                SET Password = ?
                WHERE UserID = ?
            """, (new_password, user_id))
            
            conn.commit()
            _invalidate_admin_users_cache()
            
            return jsonify({"success": True, "message": "Password updated successfully"}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


@bp.route("/users/<int:user_id>/department", methods=["PUT"])
@require_admin
def update_user_department(user_id: int):
    """
    PUT /api/admin/users/{user_id}/department

    Body: {
        "department_id": 1
    }
    """
    try:
        data = request.get_json() or {}
        if "department_id" not in data:
            return jsonify({"success": False, "error": "department_id is required"}), 400

        try:
            department_id = int(data.get("department_id"))
        except (TypeError, ValueError):
            return jsonify({"success": False, "error": "department_id must be an integer"}), 400

        updated = assign_user_department(user_id=user_id, department_id=department_id)
        if not updated:
            return jsonify({"success": False, "error": "User not found"}), 404

        _invalidate_admin_users_cache()
        return jsonify({"success": True, "message": "Department updated successfully"}), 200
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


@bp.route("/users/<int:user_id>", methods=["DELETE"])
@require_admin
def delete_user(user_id: int):
    """
    DELETE /api/admin/users/{user_id}
    
    Удаляет пользователя
    
    Защита:
    - Нельзя удалить самого себя
    - Нельзя удалить последнего администратора
    """
    try:
        # Получаем данные текущего пользователя (администратора)
        auth_header = request.headers.get('Authorization')
        token = auth_header.split(' ')[1]
        admin_data = verify_jwt_token(token)
        
        # Защита: нельзя удалить самого себя
        if admin_data['user_id'] == user_id:
            return jsonify({"success": False, "error": "You cannot delete yourself"}), 403
        
        with get_connection() as conn:
            cursor = conn.cursor()
            
            # Проверяем существование пользователя
            cursor.execute("""
                SELECT Username, IsAdmin 
                FROM Users.Users 
                WHERE UserID = ?
            """, (user_id,))
            
            user = cursor.fetchone()
            if not user:
                return jsonify({"success": False, "error": "User not found"}), 404
            
            # Защита: проверяем что это не последний администратор
            if user.IsAdmin:
                cursor.execute("""
                    SELECT COUNT(*) as admin_count
                    FROM Users.Users
                    WHERE IsAdmin = 1 AND IsActive = 1
                """)
                admin_count = cursor.fetchone().admin_count
                
                if admin_count <= 1:
                    return jsonify({
                        "success": False, 
                        "error": "Cannot delete the last administrator"
                    }), 403
            
            # Удаляем пользователя (CASCADE удалит связанные записи в UserPagePermissions и AuditLog)
            cursor.execute("""
                DELETE FROM Users.Users
                WHERE UserID = ?
            """, (user_id,))
            
            conn.commit()
            _invalidate_admin_users_cache()
            
            return jsonify({
                "success": True, 
                "message": f"User {user.Username} deleted successfully"
            }), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


@bp.route("/statistics", methods=["GET"])
@require_admin
def get_statistics():
    """
    GET /api/admin/statistics
    
    Returns system-wide statistics
    """
    try:
        stats = get_system_statistics()
        
        if stats:
            return jsonify({"success": True, "statistics": stats}), 200
        else:
            return jsonify({"success": False, "error": "Failed to get statistics"}), 500
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


@bp.route("/users/<int:user_id>/statistics", methods=["GET"])
@require_admin
def get_user_stats(user_id: int):
    """
    GET /api/admin/users/{user_id}/statistics
    
    Returns statistics for specific user
    """
    try:
        stats = get_user_statistics(user_id)
        
        if stats:
            return jsonify({"success": True, "statistics": stats}), 200
        else:
            return jsonify({"success": False, "error": "Failed to get user statistics"}), 500
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


@bp.route("/users/<int:user_id>/activity", methods=["GET"])
@require_admin
def get_user_activity(user_id: int):
    """
    GET /api/admin/users/{user_id}/activity?limit=50
    
    Returns activity log for specific user
    """
    try:
        limit = request.args.get('limit', 50, type=int)
        
        logs = get_user_activity_log(user_id, limit)
        
        return jsonify({"success": True, "activity": logs}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


def init_app(app):
    """Register blueprint in Flask app"""
    app.register_blueprint(bp)

