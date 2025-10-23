"""
Flask API: управление кастомными полями Task Manager
"""
from flask import Blueprint, jsonify, request
from ..service.custom_fields_service import CustomFieldsService
from Back.Users.service.auth_service import verify_jwt_token

bp = Blueprint("task_manager_custom_fields", __name__, url_prefix="/api/task-manager/custom-fields")


def get_current_user():
    """Получить текущего пользователя из токена"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ')[1]
    return verify_jwt_token(token)


# ============= УПРАВЛЕНИЕ ПОЛЯМИ =============

@bp.route("/project/<int:project_id>", methods=["GET"])
def get_project_fields(project_id):
    """Получить все кастомные поля проекта"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        active_only = request.args.get('active_only', 'false').lower() == 'true'
        fields = CustomFieldsService.get_project_fields(project_id, user_data["user_id"], active_only)
        return jsonify({"success": True, "data": fields}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/", methods=["POST"])
def create_field():
    """Создать новое кастомное поле"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        data = request.get_json()
        required_fields = ['project_id', 'field_name', 'field_type']
        if not data or not all(data.get(field) for field in required_fields):
            return jsonify({"success": False, "error": f"{', '.join(required_fields)} обязательны"}), 400
        
        field_id = CustomFieldsService.create_field(
            project_id=data.get('project_id'),
            user_id=user_data["user_id"],
            field_name=data.get('field_name'),
            field_type=data.get('field_type'),
            field_options=data.get('field_options'),
            is_required=data.get('is_required', False)
        )
        
        return jsonify({
            "success": True,
            "message": "Поле создано",
            "data": {"id": field_id}
        }), 201
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/<int:field_id>", methods=["PUT"])
def update_field(field_id):
    """Обновить кастомное поле"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Нет данных для обновления"}), 400
        
        CustomFieldsService.update_field(
            field_id=field_id,
            user_id=user_data["user_id"],
            field_name=data.get('field_name'),
            field_options=data.get('field_options'),
            is_required=data.get('is_required'),
            is_active=data.get('is_active'),
            order_index=data.get('order_index')
        )
        
        return jsonify({"success": True, "message": "Поле обновлено"}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/<int:field_id>", methods=["DELETE"])
def delete_field(field_id):
    """Удалить кастомное поле"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        CustomFieldsService.delete_field(field_id, user_data["user_id"])
        return jsonify({"success": True, "message": "Поле удалено"}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ============= ЗНАЧЕНИЯ ПОЛЕЙ =============

@bp.route("/task/<int:task_id>/values", methods=["GET"])
def get_task_field_values(task_id):
    """Получить значения кастомных полей для задачи"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        values = CustomFieldsService.get_task_field_values(task_id, user_data["user_id"])
        return jsonify({"success": True, "data": values}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/task/<int:task_id>/values", methods=["POST"])
def set_field_value(task_id):
    """Установить значение кастомного поля"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        data = request.get_json()
        if not data or not data.get('field_id'):
            return jsonify({"success": False, "error": "field_id обязательно"}), 400
        
        CustomFieldsService.set_field_value(
            task_id=task_id,
            field_id=data.get('field_id'),
            value=data.get('value', ''),
            user_id=user_data["user_id"]
        )
        
        return jsonify({"success": True, "message": "Значение сохранено"}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def init_app(app):
    """Регистрация blueprint в приложении"""
    app.register_blueprint(bp)

