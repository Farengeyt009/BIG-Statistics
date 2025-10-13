"""
Flask API: авторизация пользователей
"""

from flask import Blueprint, jsonify, request
from ..service.auth_service import (
    verify_login,
    generate_jwt_token,
    verify_jwt_token,
    get_user_permissions,
    check_page_permission
)
from ..service.audit_service import log_action

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
                "error": "username и password обязательны"
            }), 400
        
        username = data['username']
        password = data['password']
        
        # Проверяем логин/пароль
        user_data = verify_login(username, password)
        
        if not user_data:
            return jsonify({
                "success": False,
                "error": "Неверный логин или пароль"
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


def init_app(app):
    """Регистрирует blueprint в Flask приложении"""
    app.register_blueprint(bp)

