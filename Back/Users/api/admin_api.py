"""
Flask API: Administration - managing users and permissions
"""

from flask import Blueprint, jsonify, request
from ..service.auth_service import verify_jwt_token
from ..service.audit_service import get_system_statistics, get_user_statistics, get_user_activity_log
from ...database.db_connector import get_connection

bp = Blueprint("admin", __name__, url_prefix="/api/admin")


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
        sql = """
            SELECT 
                UserID,
                Username,
                FullName,
                Email,
                IsAdmin,
                IsActive,
                CreatedAt,
                LastLogin
            FROM Users.Users
            ORDER BY Username
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
                    'created_at': row.CreatedAt.isoformat() if row.CreatedAt else None,
                    'last_login': row.LastLogin.isoformat() if row.LastLogin else None
                })
            
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
        
        if len(new_password) < 3:
            return jsonify({"success": False, "error": "Password must be at least 3 characters"}), 400
        
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
            
            return jsonify({"success": True, "message": "Password updated successfully"}), 200
        
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

