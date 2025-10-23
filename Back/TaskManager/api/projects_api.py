"""
Flask API: управление проектами Task Manager
"""
from flask import Blueprint, jsonify, request
from ..service.projects_service import ProjectsService
from Back.Users.service.auth_service import verify_jwt_token

bp = Blueprint("task_manager_projects", __name__, url_prefix="/api/task-manager/projects")


def get_current_user():
    """Получить текущего пользователя из токена"""
    auth_header = request.headers.get('Authorization')
    
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    
    token = auth_header.split(' ')[1]
    user_data = verify_jwt_token(token)
    
    return user_data


# ============= ENDPOINTS - ПРОЕКТЫ =============

@bp.route("/", methods=["GET"])
def get_user_projects():
    """Получить все проекты текущего пользователя"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        projects = ProjectsService.get_user_projects(user_data["user_id"])
        return jsonify({"success": True, "data": projects}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/<int:project_id>", methods=["GET"])
def get_project(project_id):
    """Получить проект по ID"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        project = ProjectsService.get_project_by_id(project_id, user_data["user_id"])
        if not project:
            return jsonify({"success": False, "error": "Проект не найден или нет доступа"}), 404
        
        return jsonify({"success": True, "data": project}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/", methods=["POST"])
def create_project():
    """Создать новый проект"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        data = request.get_json()
        if not data or not data.get('name'):
            return jsonify({"success": False, "error": "Название проекта обязательно"}), 400
        
        project_id = ProjectsService.create_project(
            name=data.get('name'),
            description=data.get('description'),
            category_id=data.get('category_id'),
            owner_id=user_data["user_id"],
            has_workflow_permissions=data.get('has_workflow_permissions', False)
        )
        
        return jsonify({
            "success": True,
            "message": "Проект успешно создан",
            "data": {"id": project_id}
        }), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/<int:project_id>", methods=["PUT"])
def update_project(project_id):
    """Обновить проект (только owner)"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Нет данных для обновления"}), 400
        
        ProjectsService.update_project(
            project_id=project_id,
            user_id=user_data["user_id"],
            name=data.get('name'),
            description=data.get('description'),
            category_id=data.get('category_id'),
            has_workflow_permissions=data.get('has_workflow_permissions'),
            default_assignee_id=data.get('default_assignee_id'),
            default_subtask_assignee_id=data.get('default_subtask_assignee_id')
        )
        
        return jsonify({"success": True, "message": "Проект обновлен"}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/<int:project_id>", methods=["DELETE"])
def delete_project(project_id):
    """Удалить проект (только owner)"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        ProjectsService.delete_project(project_id, user_data["user_id"])
        return jsonify({"success": True, "message": "Проект удален"}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ============= ENDPOINTS - КАТЕГОРИИ =============

@bp.route("/categories/all", methods=["GET"])
def get_categories():
    """Получить все категории"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        categories = ProjectsService.get_categories(user_data["user_id"])
        return jsonify({"success": True, "data": categories}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/categories", methods=["POST"])
def create_category():
    """Создать новую категорию"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        data = request.get_json()
        if not data or not data.get('name'):
            return jsonify({"success": False, "error": "Название категории обязательно"}), 400
        
        category_id = ProjectsService.create_category(
            name=data.get('name'),
            description=data.get('description'),
            icon=data.get('icon'),
            color=data.get('color', '#3b82f6'),
            user_id=user_data["user_id"]
        )
        
        return jsonify({
            "success": True,
            "message": "Категория создана",
            "data": {"id": category_id}
        }), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# ============= ENDPOINTS - УЧАСТНИКИ =============

@bp.route("/<int:project_id>/members", methods=["GET"])
def get_project_members(project_id):
    """Получить список участников проекта"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        members = ProjectsService.get_project_members(project_id, user_data["user_id"])
        return jsonify({"success": True, "data": members}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/<int:project_id>/members", methods=["POST"])
def add_project_member(project_id):
    """Добавить участника в проект"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        data = request.get_json()
        if not data or not data.get('user_id') or not data.get('role'):
            return jsonify({"success": False, "error": "user_id и role обязательны"}), 400
        
        ProjectsService.add_project_member(
            project_id=project_id,
            user_id=user_data["user_id"],
            new_member_id=data.get('user_id'),
            role=data.get('role')
        )
        
        return jsonify({"success": True, "message": "Участник добавлен"}), 201
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/<int:project_id>/members/<int:member_id>/role", methods=["PUT"])
def update_member_role(project_id, member_id):
    """Изменить роль участника"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        data = request.get_json()
        if not data or not data.get('role'):
            return jsonify({"success": False, "error": "role обязательно"}), 400
        
        ProjectsService.update_member_role(
            project_id=project_id,
            user_id=user_data["user_id"],
            member_id=member_id,
            new_role=data.get('role')
        )
        
        return jsonify({"success": True, "message": "Роль изменена"}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/<int:project_id>/members/<int:member_id>", methods=["DELETE"])
def remove_project_member(project_id, member_id):
    """Удалить участника из проекта"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        ProjectsService.remove_project_member(
            project_id=project_id,
            user_id=user_data["user_id"],
            member_id=member_id
        )
        
        return jsonify({"success": True, "message": "Участник удален"}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/<int:project_id>/transfer-ownership", methods=["POST"])
def transfer_ownership(project_id):
    """Передать права владельца"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        data = request.get_json()
        if not data or not data.get('new_owner_id'):
            return jsonify({"success": False, "error": "new_owner_id обязательно"}), 400
        
        ProjectsService.transfer_ownership(
            project_id=project_id,
            current_owner_id=user_data["user_id"],
            new_owner_id=data.get('new_owner_id')
        )
        
        return jsonify({"success": True, "message": "Права владельца переданы"}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def init_app(app):
    """Регистрация blueprint в приложении"""
    app.register_blueprint(bp)

