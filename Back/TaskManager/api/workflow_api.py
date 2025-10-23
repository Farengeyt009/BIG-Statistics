"""
Flask API: управление воркфлоу Task Manager
"""
from flask import Blueprint, jsonify, request
from ..service.workflow_service import WorkflowService
from Back.Users.service.auth_service import verify_jwt_token

bp = Blueprint("task_manager_workflow", __name__, url_prefix="/api/task-manager/workflow")


def get_current_user():
    """Получить текущего пользователя из токена"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ')[1]
    return verify_jwt_token(token)


# ============= СТАТУСЫ =============

@bp.route("/projects/<int:project_id>/statuses", methods=["GET"])
def get_project_statuses(project_id):
    """Получить все статусы проекта"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        statuses = WorkflowService.get_project_statuses(project_id, user_data["user_id"])
        return jsonify({"success": True, "data": statuses}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/statuses", methods=["POST"])
def create_status():
    """Создать новый статус"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        data = request.get_json()
        if not data or not data.get('project_id') or not data.get('name'):
            return jsonify({"success": False, "error": "project_id и name обязательны"}), 400
        
        status_id = WorkflowService.create_status(
            project_id=data.get('project_id'),
            user_id=user_data["user_id"],
            name=data.get('name'),
            color=data.get('color', '#3b82f6'),
            order_index=data.get('order_index', 0),
            is_initial=data.get('is_initial', False),
            is_final=data.get('is_final', False)
        )
        
        return jsonify({
            "success": True,
            "message": "Статус создан",
            "data": {"id": status_id}
        }), 201
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/statuses/<int:status_id>", methods=["PUT"])
def update_status(status_id):
    """Обновить статус"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Нет данных для обновления"}), 400
        
        WorkflowService.update_status(
            status_id=status_id,
            user_id=user_data["user_id"],
            name=data.get('name'),
            color=data.get('color'),
            order_index=data.get('order_index'),
            is_initial=data.get('is_initial'),
            is_final=data.get('is_final')
        )
        
        return jsonify({"success": True, "message": "Статус обновлен"}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/statuses/<int:status_id>", methods=["DELETE"])
def delete_status(status_id):
    """Удалить статус"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        WorkflowService.delete_status(status_id, user_data["user_id"])
        return jsonify({"success": True, "message": "Статус удален"}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ============= ПЕРЕХОДЫ =============

@bp.route("/projects/<int:project_id>/transitions", methods=["GET"])
def get_project_transitions(project_id):
    """Получить все переходы воркфлоу проекта"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        transitions = WorkflowService.get_project_transitions(project_id, user_data["user_id"])
        return jsonify({"success": True, "data": transitions}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/transitions", methods=["POST"])
def create_transition():
    """Создать переход между статусами"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        data = request.get_json()
        required = ['project_id', 'from_status_id', 'to_status_id']
        if not data or not all(data.get(field) for field in required):
            return jsonify({"success": False, "error": f"{', '.join(required)} обязательны"}), 400
        
        # Автоматически генерируем название перехода если не указано
        if not data.get('name'):
            from_status = data.get('from_status_name', f"Статус {data.get('from_status_id')}")
            to_status = data.get('to_status_name', f"Статус {data.get('to_status_id')}")
            data['name'] = f"{from_status} → {to_status}"
        
        transition_id = WorkflowService.create_transition(
            project_id=data.get('project_id'),
            user_id=user_data["user_id"],
            from_status_id=data.get('from_status_id'),
            to_status_id=data.get('to_status_id'),
            name=data.get('name'),
            allowed_roles=data.get('allowed_roles'),
            permission_type=data.get('permission_type', 'roles'),
            allowed_users=data.get('allowed_users'),
            is_bidirectional=data.get('is_bidirectional', False),
            requires_attachment=data.get('requires_attachment', False),
            requires_approvals=data.get('requires_approvals', False),
            required_approvals_count=data.get('required_approvals_count', 0),
            required_approvers=data.get('required_approvers'),
            auto_transition=data.get('auto_transition', False)
        )
        
        return jsonify({
            "success": True,
            "message": "Переход создан",
            "data": {"id": transition_id}
        }), 201
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/transitions/<int:transition_id>", methods=["PUT"])
def update_transition(transition_id):
    """Обновить переход"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Нет данных для обновления"}), 400
        
        WorkflowService.update_transition(
            transition_id=transition_id,
            user_id=user_data["user_id"],
            name=data.get('name'),
            allowed_roles=data.get('allowed_roles'),
            permission_type=data.get('permission_type'),
            allowed_users=data.get('allowed_users'),
            is_bidirectional=data.get('is_bidirectional'),
            requires_attachment=data.get('requires_attachment'),
            requires_approvals=data.get('requires_approvals'),
            required_approvals_count=data.get('required_approvals_count'),
            required_approvers=data.get('required_approvers'),
            auto_transition=data.get('auto_transition')
        )
        
        return jsonify({"success": True, "message": "Переход обновлен"}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/transitions/<int:transition_id>", methods=["DELETE"])
def delete_transition(transition_id):
    """Удалить переход"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        WorkflowService.delete_transition(transition_id, user_data["user_id"])
        return jsonify({"success": True, "message": "Переход удален"}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def init_app(app):
    """Регистрация blueprint в приложении"""
    app.register_blueprint(bp)
