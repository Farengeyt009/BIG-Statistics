"""
Flask API: управление профилем пользователя
"""

from flask import Blueprint, jsonify, request
from ..service.auth_service import verify_jwt_token
from ..service.users_service import update_user_profile, get_user_by_id
from ..service.avatar_service import save_avatar, get_avatar_path

bp = Blueprint("users", __name__, url_prefix="/api/users")


@bp.route("/profile", methods=["GET"])
def get_profile():
    """
    GET /api/users/profile
    
    Headers:
        Authorization: Bearer <token>
    
    Response:
        {
            "success": true,
            "user": {...}
        }
    """
    try:
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"success": False, "error": "Токен не предоставлен"}), 401
        
        token = auth_header.split(' ')[1]
        user_data = verify_jwt_token(token)
        
        if not user_data:
            return jsonify({"success": False, "error": "Невалидный токен"}), 401
        
        user = get_user_by_id(user_data['user_id'])
        
        if not user:
            return jsonify({"success": False, "error": "Пользователь не найден"}), 404
        
        return jsonify({"success": True, "user": user}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Ошибка сервера: {str(e)}"}), 500


@bp.route("/profile", methods=["PUT"])
def update_profile():
    """
    PUT /api/users/profile
    
    Headers:
        Authorization: Bearer <token>
    
    Body:
        {
            "full_name": "Новое имя",  // опционально
            "password": "новый_пароль"  // опционально
        }
    
    Response:
        {
            "success": true,
            "user": {...}
        }
    """
    try:
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"success": False, "error": "Токен не предоставлен"}), 401
        
        token = auth_header.split(' ')[1]
        user_data = verify_jwt_token(token)
        
        if not user_data:
            return jsonify({"success": False, "error": "Невалидный токен"}), 401
        
        data = request.get_json()
        
        if not data:
            return jsonify({"success": False, "error": "Нет данных для обновления"}), 400
        
        full_name = data.get('full_name')
        password = data.get('password')
        
        if not full_name and not password:
            return jsonify({"success": False, "error": "Укажите хотя бы одно поле для обновления"}), 400
        
        # Валидация пароля (минимум 6 символов)
        if password and len(password) < 6:
            return jsonify({"success": False, "error": "Пароль должен быть минимум 6 символов"}), 400
        
        updated_user = update_user_profile(
            user_id=user_data['user_id'],
            full_name=full_name,
            password=password
        )
        
        return jsonify({"success": True, "user": updated_user, "message": "Профиль обновлен успешно"}), 200
        
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": f"Ошибка сервера: {str(e)}"}), 500


@bp.route("/avatar", methods=["POST"])
def upload_avatar():
    """
    POST /api/users/avatar
    
    Headers:
        Authorization: Bearer <token>
    
    Body:
        multipart/form-data
        avatar: файл изображения
    
    Response:
        {
            "success": true,
            "filename": "avatar_2.png",
            "message": "Аватарка обновлена успешно"
        }
    """
    try:
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"success": False, "error": "Токен не предоставлен"}), 401
        
        token = auth_header.split(' ')[1]
        user_data = verify_jwt_token(token)
        
        if not user_data:
            return jsonify({"success": False, "error": "Невалидный токен"}), 401
        
        # Проверяем наличие файла
        if 'avatar' not in request.files:
            return jsonify({"success": False, "error": "Файл не найден"}), 400
        
        file = request.files['avatar']
        
        # Сохраняем аватарку
        success, result = save_avatar(user_data['user_id'], file)
        
        if success:
            return jsonify({
                "success": True,
                "filename": result,
                "message": "Аватарка обновлена успешно"
            }), 200
        else:
            return jsonify({"success": False, "error": result}), 400
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Ошибка сервера: {str(e)}"}), 500


@bp.route("/avatar", methods=["GET"])
def get_avatar():
    """
    GET /api/users/avatar
    
    Headers:
        Authorization: Bearer <token>
    
    Response:
        {
            "success": true,
            "filename": "avatar_2.png" или null
        }
    """
    try:
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"success": False, "error": "Токен не предоставлен"}), 401
        
        token = auth_header.split(' ')[1]
        user_data = verify_jwt_token(token)
        
        if not user_data:
            return jsonify({"success": False, "error": "Невалидный токен"}), 401
        
        filename = get_avatar_path(user_data['user_id'])
        
        return jsonify({"success": True, "filename": filename}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Ошибка сервера: {str(e)}"}), 500


def init_app(app):
    """Регистрирует blueprint в Flask приложении"""
    app.register_blueprint(bp)

