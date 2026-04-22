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


def _perf_response(payload: dict, status_code: int, started: float, label: str):
    _ = started
    _ = label
    return jsonify(payload), status_code


# ============= УПРАВЛЕНИЕ ПОЛЯМИ =============

@bp.route("/project/<int:project_id>", methods=["GET"])
def get_project_fields(project_id):
    """Получить все кастомные поля проекта"""
    started = None
    try:
        user_data = get_current_user()
        if not user_data:
            return _perf_response({"success": False, "error": "Не авторизован"}, 401, started, "GET /custom-fields/project/:id")
        
        active_only = request.args.get('active_only', 'false').lower() == 'true'
        fields = CustomFieldsService.get_project_fields(project_id, user_data["user_id"], active_only)
        return _perf_response({"success": True, "data": fields}, 200, started, "GET /custom-fields/project/:id")
    except PermissionError as e:
        return _perf_response({"success": False, "error": str(e)}, 403, started, "GET /custom-fields/project/:id")
    except Exception as e:
        return _perf_response({"success": False, "error": str(e)}, 500, started, "GET /custom-fields/project/:id")


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
    """Получить значения кастомных полей для задачи (multi-row)"""
    started = None
    try:
        user_data = get_current_user()
        if not user_data:
            return _perf_response({"success": False, "error": "Не авторизован"}, 401, started, "GET /custom-fields/task/:id/values")
        
        result = CustomFieldsService.get_task_field_values(task_id, user_data["user_id"])
        return _perf_response({"success": True, "data": result}, 200, started, "GET /custom-fields/task/:id/values")
    except PermissionError as e:
        return _perf_response({"success": False, "error": str(e)}, 403, started, "GET /custom-fields/task/:id/values")
    except Exception as e:
        return _perf_response({"success": False, "error": str(e)}, 500, started, "GET /custom-fields/task/:id/values")


@bp.route("/task/<int:task_id>/rows", methods=["POST"])
def save_task_rows(task_id):
    """Сохранить все строки значений для задачи"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        data = request.get_json()
        if not data or "rows" not in data:
            return jsonify({"success": False, "error": "rows обязательно"}), 400
        
        CustomFieldsService.save_task_rows(
            task_id=task_id,
            user_id=user_data["user_id"],
            rows=data["rows"]
        )
        return jsonify({"success": True, "message": "Строки сохранены"}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def init_app(app):
    """Регистрация blueprint в приложении"""
    app.register_blueprint(bp)

