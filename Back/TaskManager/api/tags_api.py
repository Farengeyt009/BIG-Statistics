"""
Flask API: управление тегами Task Manager
"""
from flask import Blueprint, jsonify, request
from ..service.tags_service import TagsService
from Back.Users.service.auth_service import verify_jwt_token

bp = Blueprint("task_manager_tags", __name__, url_prefix="/api/task-manager/tags")


def get_current_user():
    """Получить текущего пользователя из токена"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ')[1]
    return verify_jwt_token(token)


@bp.route("/project/<int:project_id>", methods=["GET"])
def get_project_tags(project_id):
    """Получить все теги проекта"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        tags = TagsService.get_project_tags(project_id, user_data["user_id"])
        return jsonify({"success": True, "data": tags}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/", methods=["POST"])
def create_tag():
    """Создать новый тег"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        data = request.get_json()
        if not data or not data.get('project_id') or not data.get('name'):
            return jsonify({"success": False, "error": "project_id и name обязательны"}), 400
        
        tag_id = TagsService.create_tag(
            project_id=data.get('project_id'),
            user_id=user_data["user_id"],
            name=data.get('name'),
            color=data.get('color', '#3b82f6')
        )
        
        return jsonify({
            "success": True,
            "message": "Тег создан",
            "data": {"id": tag_id}
        }), 201
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/<int:tag_id>", methods=["PUT"])
def update_tag(tag_id):
    """Обновить тег"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Нет данных для обновления"}), 400
        
        TagsService.update_tag(
            tag_id=tag_id,
            user_id=user_data["user_id"],
            name=data.get('name'),
            color=data.get('color')
        )
        
        return jsonify({"success": True, "message": "Тег обновлен"}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/<int:tag_id>", methods=["DELETE"])
def delete_tag(tag_id):
    """Удалить тег"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        TagsService.delete_tag(tag_id, user_data["user_id"])
        return jsonify({"success": True, "message": "Тег удален"}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def init_app(app):
    """Регистрация blueprint в приложении"""
    app.register_blueprint(bp)
