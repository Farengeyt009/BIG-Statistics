"""
Flask API: управление задачами Task Manager
"""
from flask import Blueprint, jsonify, request
from ..service.tasks_service import TasksService
from Back.Users.service.auth_service import verify_jwt_token

bp = Blueprint("task_manager_tasks", __name__, url_prefix="/api/task-manager/tasks")


def get_current_user():
    """Получить текущего пользователя из токена"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ')[1]
    return verify_jwt_token(token)


@bp.route("/project/<int:project_id>", methods=["GET"])
def get_project_tasks(project_id):
    """Получить задачи проекта"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        parent_task_id = request.args.get('parent_task_id', type=int)
        tasks = TasksService.get_project_tasks(project_id, user_data["user_id"], parent_task_id)
        return jsonify({"success": True, "data": tasks}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/<int:task_id>", methods=["GET"])
def get_task(task_id):
    """Получить задачу по ID"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        task = TasksService.get_task_by_id(task_id, user_data["user_id"])
        if not task:
            return jsonify({"success": False, "error": "Задача не найдена"}), 404
        return jsonify({"success": True, "data": task}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/", methods=["POST"])
def create_task():
    """Создать новую задачу"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        data = request.get_json()
        if not data or not data.get('project_id') or not data.get('title'):
            return jsonify({"success": False, "error": "project_id и title обязательны"}), 400
        
        task_id = TasksService.create_task(
            project_id=data.get('project_id'),
            user_id=user_data["user_id"],
            title=data.get('title'),
            description=data.get('description'),
            status_id=data.get('status_id'),
            assignee_id=data.get('assignee_id'),
            priority=data.get('priority', 'medium'),
            due_date=data.get('due_date'),
            parent_task_id=data.get('parent_task_id'),
            tag_ids=data.get('tag_ids')
        )
        
        return jsonify({
            "success": True,
            "message": "Задача создана",
            "data": {"id": task_id}
        }), 201
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/<int:task_id>", methods=["PUT"])
def update_task(task_id):
    """Обновить задачу"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Нет данных для обновления"}), 400
        
        TasksService.update_task(
            task_id=task_id,
            user_id=user_data["user_id"],
            title=data.get('title'),
            description=data.get('description'),
            status_id=data.get('status_id'),
            assignee_id=data.get('assignee_id'),
            priority=data.get('priority'),
            due_date=data.get('due_date'),
            tag_ids=data.get('tag_ids')
        )
        
        return jsonify({"success": True, "message": "Задача обновлена"}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    """Удалить задачу"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        TasksService.delete_task(task_id, user_data["user_id"])
        return jsonify({"success": True, "message": "Задача удалена"}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/project/<int:project_id>/reorder", methods=["POST"])
def reorder_tasks(project_id):
    """Изменить порядок задач"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        data = request.get_json()
        if not data or not data.get('task_orders'):
            return jsonify({"success": False, "error": "task_orders обязательно"}), 400
        
        TasksService.reorder_tasks(project_id, user_data["user_id"], data.get('task_orders'))
        return jsonify({"success": True, "message": "Порядок обновлен"}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def init_app(app):
    """Регистрация blueprint в приложении"""
    app.register_blueprint(bp)
