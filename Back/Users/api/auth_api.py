"""
Flask API: авторизация пользователей
"""

from flask import Blueprint, jsonify, request
from ..service.auth_service import (
    verify_login,
    generate_jwt_token,
    verify_jwt_token,
    get_user_permissions,
    check_page_permission,
    check_username_available,
    register_user
)
from ..service.audit_service import log_action
from ..service.skud_service import check_empcode_in_skud
from ...database.db_connector import get_connection

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@bp.route("/login", methods=["POST"])
def login():
    """
    POST /api/auth/login
    
    Body:
        {
            "username": "GM",
            "password": "123"
        }
    
    Response:
        {
            "success": true,
            "token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
            "user": {
                "user_id": 2,
                "username": "GM",
                "full_name": "GM User",
                "is_admin": false
            },
            "permissions": [
                {"page_key": "kpi", "can_view": true, "can_edit": false}
            ]
        }
    """
    try:
        data = request.get_json()
        
        if not data or 'username' not in data or 'password' not in data:
            return jsonify({
                "success": False,
                "error": "MISSING_CREDENTIALS"
            }), 400
        
        username = data['username']
        password = data['password']
        
        # Проверяем логин/пароль
        user_data = verify_login(username, password)
        
        if not user_data:
            return jsonify({
                "success": False,
                "error": "INVALID_CREDENTIALS"
            }), 401
        
        # Генерируем JWT токен
        token = generate_jwt_token(user_data)
        
        # Получаем права пользователя
        permissions = get_user_permissions(user_data['UserID'])
        
        # Логируем успешный вход
        try:
            ip_address = request.remote_addr
            user_agent = request.headers.get('User-Agent', '')
            log_action(
                user_id=user_data['UserID'],
                action_type='login',
                ip_address=ip_address,
                user_agent=user_agent
            )
        except Exception as log_error:
            # Не прерываем логин если логирование упало
            print(f"Logging error: {str(log_error)}")
        
        return jsonify({
            "success": True,
            "token": token,
            "user": {
                "user_id": user_data['UserID'],
                "username": user_data['Username'],
                "full_name": user_data['FullName'],
                "email": user_data['Email'],
                "is_admin": user_data['IsAdmin']
            },
            "permissions": permissions
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Ошибка сервера: {str(e)}"
        }), 500


@bp.route("/me", methods=["GET"])
def get_current_user():
    """
    GET /api/auth/me
    
    Headers:
        Authorization: Bearer <token>
    
    Response:
        {
            "success": true,
            "user": {
                "user_id": 2,
                "username": "GM",
                "is_admin": false
            },
            "permissions": [...]
        }
    """
    try:
        # Получаем токен из заголовка
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({
                "success": False,
                "error": "Токен не предоставлен"
            }), 401
        
        token = auth_header.split(' ')[1]
        
        # Проверяем токен
        user_data = verify_jwt_token(token)
        
        if not user_data:
            return jsonify({
                "success": False,
                "error": "Невалидный или истёкший токен"
            }), 401
        
        # Получаем права пользователя
        permissions = get_user_permissions(user_data['user_id'])
        
        return jsonify({
            "success": True,
            "user": user_data,
            "permissions": permissions
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Ошибка сервера: {str(e)}"
        }), 500


@bp.route("/check-permission", methods=["POST"])
def check_permission():
    """
    POST /api/auth/check-permission
    
    Headers:
        Authorization: Bearer <token>
    
    Body:
        {
            "page_key": "kpi",
            "permission_type": "view"  // или "edit"
        }
    
    Response:
        {
            "success": true,
            "has_permission": true
        }
    """
    try:
        # Получаем токен
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({
                "success": False,
                "error": "Токен не предоставлен"
            }), 401
        
        token = auth_header.split(' ')[1]
        user_data = verify_jwt_token(token)
        
        if not user_data:
            return jsonify({
                "success": False,
                "error": "Невалидный токен"
            }), 401
        
        # Получаем параметры
        data = request.get_json()
        page_key = data.get('page_key')
        permission_type = data.get('permission_type', 'view')
        
        if not page_key:
            return jsonify({
                "success": False,
                "error": "page_key обязателен"
            }), 400
        
        # Проверяем право
        has_permission = check_page_permission(
            user_data['user_id'],
            page_key,
            permission_type
        )
        
        return jsonify({
            "success": True,
            "has_permission": has_permission
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Ошибка сервера: {str(e)}"
        }), 500


@bp.route("/log-page-view", methods=["POST"])
def log_page_view():
    """
    POST /api/auth/log-page-view
    
    Headers:
        Authorization: Bearer <token>
    
    Body:
        {
            "page_key": "production"
        }
    
    Логирует посещение страницы
    """
    try:
        # Получаем токен
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"success": False, "error": "Token not provided"}), 401
        
        token = auth_header.split(' ')[1]
        user_data = verify_jwt_token(token)
        
        if not user_data:
            return jsonify({"success": False, "error": "Invalid token"}), 401
        
        # Получаем page_key из тела запроса
        data = request.get_json()
        page_key = data.get('page_key') if data else None
        
        if not page_key:
            return jsonify({"success": False, "error": "page_key is required"}), 400
        
        # Логируем посещение страницы
        try:
            ip_address = request.remote_addr
            log_action(
                user_id=user_data['user_id'],
                action_type='page_view',
                page_key=page_key,
                ip_address=ip_address
            )
        except Exception as log_error:
            print(f"Logging error: {str(log_error)}")
        
        return jsonify({"success": True}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


@bp.route("/session-start", methods=["POST"])
def session_start():
    """
    POST /api/auth/session-start
    
    Headers:
        Authorization: Bearer <token>
    
    Логирует начало сессии (когда пользователь открывает приложение с существующим токеном)
    """
    try:
        # Получаем токен
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"success": False, "error": "Token not provided"}), 401
        
        token = auth_header.split(' ')[1]
        user_data = verify_jwt_token(token)
        
        if not user_data:
            return jsonify({"success": False, "error": "Invalid token"}), 401
        
        # Логируем начало сессии
        try:
            ip_address = request.remote_addr
            user_agent = request.headers.get('User-Agent', '')
            log_action(
                user_id=user_data['user_id'],
                action_type='session_start',
                ip_address=ip_address,
                user_agent=user_agent
            )
        except Exception as log_error:
            print(f"Logging error: {str(log_error)}")
        
        return jsonify({"success": True}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


@bp.route("/logout", methods=["POST"])
def logout():
    """
    POST /api/auth/logout
    
    Headers:
        Authorization: Bearer <token>
    
    На стороне сервера токены stateless (JWT), поэтому просто возвращаем успех.
    Клиент должен удалить токен из localStorage.
    """
    try:
        # Получаем токен для логирования
        auth_header = request.headers.get('Authorization')
        
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            user_data = verify_jwt_token(token)
            
            if user_data:
                # Логируем выход
                try:
                    ip_address = request.remote_addr
                    log_action(
                        user_id=user_data['user_id'],
                        action_type='logout',
                        ip_address=ip_address
                    )
                except Exception as log_error:
                    print(f"Logging error: {str(log_error)}")
        
        return jsonify({
            "success": True,
            "message": "Вы вышли из системы"
        }), 200
        
    except Exception as e:
        # Даже если что-то пошло не так, разрешаем выйти
        return jsonify({
            "success": True,
            "message": "Вы вышли из системы"
        }), 200


@bp.route("/check-empcode", methods=["POST"])
def check_empcode():
    """
    POST /api/auth/check-empcode
    
    Body:
        {
            "empcode": "12345"
        }
    
    Response:
        {
            "success": true,
            "exists_in_users": false,
            "exists_in_skud": true,
            "employee_data": {
                "empcode": "12345",
                "empname": "Иван Петров",
                "isactive": true
            }
        }
    """
    try:
        data = request.get_json()
        empcode = data.get('empcode')
        
        if not empcode:
            return jsonify({"success": False, "error": "empcode is required"}), 400
        
        # Проверяем существует ли empcode в Users.Users (независимо от пароля)
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT UserID, Username 
                FROM Users.Users 
                WHERE empcode = ?
            """, (empcode,))
            
            existing_user = cursor.fetchone()
            
            if existing_user:
                # Empcode уже зарегистрирован
                return jsonify({
                    "success": True,
                    "exists_in_users": True,
                    "exists_in_skud": False,
                    "message": "User already registered. Please login with your password."
                }), 200
        
        # Проверяем в СКУД
        skud_data = check_empcode_in_skud(empcode)
        
        if skud_data and skud_data.get('exists'):
            if not skud_data.get('isactive'):
                return jsonify({
                    "success": False,
                    "error": "Employee is not active in SKUD"
                }), 403
            
            return jsonify({
                "success": True,
                "exists_in_users": False,
                "exists_in_skud": True,
                "employee_data": {
                    "empcode": skud_data['empcode'],
                    "empname": skud_data['empname'],
                    "isactive": skud_data['isactive']
                }
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "Employee code not found in SKUD"
            }), 404
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


@bp.route("/check-username", methods=["POST"])
def check_username():
    """
    POST /api/auth/check-username
    
    Body:
        {
            "username": "ivanov"
        }
    
    Response:
        {
            "success": true,
            "available": true
        }
    """
    try:
        data = request.get_json()
        username = data.get('username')
        
        if not username:
            return jsonify({"success": False, "error": "username is required"}), 400
        
        available = check_username_available(username)
        
        return jsonify({
            "success": True,
            "available": available
        }), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


@bp.route("/register", methods=["POST"])
def register():
    """
    POST /api/auth/register
    
    Body:
        {
            "empcode": "12345",
            "username": "ivanov",
            "password": "mypassword",
            "email": "ivan@example.com"  // optional
        }
    
    Response:
        {
            "success": true,
            "token": "...",
            "user": {...},
            "permissions": [...]
        }
    """
    try:
        data = request.get_json()
        
        empcode = data.get('empcode')
        username = data.get('username')
        password = data.get('password')
        email = data.get('email')
        
        # Валидация
        if not empcode or not username or not password:
            return jsonify({
                "success": False,
                "error": "empcode, username and password are required"
            }), 400
        
        # Проверяем что empcode есть в СКУД
        skud_data = check_empcode_in_skud(empcode)
        
        if not skud_data or not skud_data.get('exists'):
            return jsonify({
                "success": False,
                "error": "Employee code not found in SKUD"
            }), 404
        
        if not skud_data.get('isactive'):
            return jsonify({
                "success": False,
                "error": "Employee is not active in SKUD"
            }), 403
        
        # Регистрируем пользователя
        full_name = str(skud_data.get('empname', ''))
        new_user = register_user(empcode, username, password, full_name, email)
        
        if not new_user:
            return jsonify({
                "success": False,
                "error": "Failed to register user. Username may be already taken."
            }), 400
        
        # Генерируем токен и автоматически логиним
        token = generate_jwt_token(new_user)
        permissions = get_user_permissions(new_user['UserID'])
        
        # Логируем регистрацию и первый вход
        try:
            ip_address = request.remote_addr
            user_agent = request.headers.get('User-Agent', '')
            log_action(
                user_id=new_user['UserID'],
                action_type='register',
                ip_address=ip_address,
                user_agent=user_agent
            )
            log_action(
                user_id=new_user['UserID'],
                action_type='login',
                ip_address=ip_address,
                user_agent=user_agent
            )
        except Exception as log_error:
            print(f"Logging error: {str(log_error)}")
        
        return jsonify({
            "success": True,
            "token": token,
            "user": {
                "user_id": new_user['UserID'],
                "username": new_user['Username'],
                "empcode": new_user['empcode'],
                "full_name": new_user['FullName'],
                "email": new_user['Email'],
                "is_admin": new_user['IsAdmin']
            },
            "permissions": permissions
        }), 201
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Server error: {str(e)}"
        }), 500


def init_app(app):
    """Регистрирует blueprint в Flask приложении"""
    app.register_blueprint(bp)

