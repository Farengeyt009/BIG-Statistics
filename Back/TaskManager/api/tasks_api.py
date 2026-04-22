"""
Flask API: управление задачами Task Manager
"""
from flask import Blueprint, jsonify, request, send_file
from ..service.tasks_service import TasksService
from ..service.custom_fields_service import CustomFieldsService
from Back.Users.service.auth_service import verify_jwt_token

bp = Blueprint("task_manager_tasks", __name__, url_prefix="/api/task-manager/tasks")


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


@bp.route("/project/<int:project_id>", methods=["GET"])
def get_project_tasks(project_id):
    """Получить задачи проекта"""
    started = None
    try:
        user_data = get_current_user()
        if not user_data:
            return _perf_response({"success": False, "error": "Не авторизован"}, 401, started, "GET /tasks/project")
        
        parent_task_id = request.args.get('parent_task_id', type=int)
        include_tags = request.args.get('include_tags', '1') != '0'
        include_custom_fields = request.args.get('include_custom_fields', '1') != '0'
        tasks = TasksService.get_project_tasks(
            project_id,
            user_data["user_id"],
            parent_task_id,
            include_tags=include_tags,
            include_custom_fields=include_custom_fields,
        )
        return _perf_response({"success": True, "data": tasks}, 200, started, "GET /tasks/project")
    except PermissionError as e:
        return _perf_response({"success": False, "error": str(e)}, 403, started, "GET /tasks/project")
    except Exception as e:
        return _perf_response({"success": False, "error": str(e)}, 500, started, "GET /tasks/project")


@bp.route("/<int:task_id>", methods=["GET"])
def get_task(task_id):
    """Получить задачу по ID"""
    started = None
    try:
        user_data = get_current_user()
        if not user_data:
            return _perf_response({"success": False, "error": "Не авторизован"}, 401, started, "GET /tasks/:id")
        
        task = TasksService.get_task_by_id(task_id, user_data["user_id"])
        if not task:
            return _perf_response({"success": False, "error": "Задача не найдена"}, 404, started, "GET /tasks/:id")
        return _perf_response({"success": True, "data": task}, 200, started, "GET /tasks/:id")
    except PermissionError as e:
        return _perf_response({"success": False, "error": str(e)}, 403, started, "GET /tasks/:id")
    except Exception as e:
        return _perf_response({"success": False, "error": str(e)}, 500, started, "GET /tasks/:id")


@bp.route("/", methods=["POST"])
def create_task():
    """Создать новую задачу"""
    started = None
    try:
        user_data = get_current_user()
        if not user_data:
            return _perf_response({"success": False, "error": "Не авторизован"}, 401, started, "POST /tasks")
        
        data = request.get_json()
        if not data or not data.get('project_id') or not data.get('title'):
            return _perf_response({"success": False, "error": "project_id и title обязательны"}, 400, started, "POST /tasks")
        
        task_id = TasksService.create_task(
            project_id=data.get('project_id'),
            user_id=user_data["user_id"],
            title=data.get('title'),
            description=data.get('description'),
            status_id=data.get('status_id'),
            assignee_id=data.get('assignee_id'),
            priority=data.get('priority', 'medium'),
            due_date=data.get('due_date'),
            start_date=data.get('start_date'),
            parent_task_id=data.get('parent_task_id'),
            tag_ids=data.get('tag_ids')
        )
        
        return _perf_response({
            "success": True,
            "message": "Задача создана",
            "data": {"id": task_id}
        }, 201, started, "POST /tasks")
    except PermissionError as e:
        return _perf_response({"success": False, "error": str(e)}, 403, started, "POST /tasks")
    except Exception as e:
        return _perf_response({"success": False, "error": str(e)}, 500, started, "POST /tasks")


@bp.route("/<int:task_id>", methods=["PUT"])
def update_task(task_id):
    """Обновить задачу"""
    started = None
    try:
        user_data = get_current_user()
        if not user_data:
            return _perf_response({"success": False, "error": "Не авторизован"}, 401, started, "PUT /tasks/:id")
        
        data = request.get_json()
        if not data:
            return _perf_response({"success": False, "error": "Нет данных для обновления"}, 400, started, "PUT /tasks/:id")
        
        TasksService.update_task(
            task_id=task_id,
            user_id=user_data["user_id"],
            title=data.get('title'),
            description=data.get('description'),
            status_id=data.get('status_id'),
            assignee_id=data.get('assignee_id'),
            clear_assignee=('assignee_id' in data and data.get('assignee_id') is None),
            priority=data.get('priority'),
            due_date=data.get('due_date'),
            clear_due_date=('due_date' in data and data.get('due_date') is None),
            start_date=data.get('start_date'),
            clear_start_date=('start_date' in data and data.get('start_date') is None),
            tag_ids=data.get('tag_ids')
        )
        
        return _perf_response({"success": True, "message": "Задача обновлена"}, 200, started, "PUT /tasks/:id")
    except PermissionError as e:
        return _perf_response({"success": False, "error": str(e)}, 403, started, "PUT /tasks/:id")
    except Exception as e:
        return _perf_response({"success": False, "error": str(e)}, 500, started, "PUT /tasks/:id")


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


@bp.route("/subtasks/<int:subtask_id>/toggle-complete", methods=["POST"])
def toggle_subtask_complete(subtask_id):
    """Переключить выполнение подзадачи (чекбокс)"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401

        TasksService.toggle_subtask_complete(subtask_id, user_data["user_id"])
        return jsonify({"success": True, "message": "Статус подзадачи обновлен"}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/project/<int:project_id>/history", methods=["GET"])
def get_project_history(project_id):
    """Получить историю изменений задач проекта"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401

        limit = request.args.get('limit', 20, type=int)
        limit = max(1, min(limit, 100))

        history = TasksService.get_project_history(project_id, user_data["user_id"], limit)
        return jsonify({"success": True, "data": history}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def init_app(app):
    """Регистрация blueprint в приложении"""
    app.register_blueprint(bp)


@bp.route("/project/<int:project_id>/export", methods=["GET"])
def export_project_tasks(project_id):
    """Экспортировать задачи проекта в Excel"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401

        from ..service.export_service import export_tasks_to_excel

        lang = request.args.get('lang', 'ru')

        # Опциональный фильтр по выбранным задачам
        task_ids_param = request.args.get('task_ids', '')
        task_ids = [int(i) for i in task_ids_param.split(',') if i.strip().isdigit()] if task_ids_param else None

        # Параметры активных фильтров (применяются только если нет task_ids)
        status_ids_param = request.args.get('status_ids', '')
        status_ids = [int(i) for i in status_ids_param.split(',') if i.strip().isdigit()] if status_ids_param else None

        priorities_param = request.args.get('priorities', '')
        priorities = [p.strip() for p in priorities_param.split(',') if p.strip()] if priorities_param else None

        assignee_ids_param = request.args.get('assignee_ids', '')
        assignee_ids = [int(i) for i in assignee_ids_param.split(',') if i.strip().isdigit()] if assignee_ids_param else None
        include_unassigned = request.args.get('include_unassigned', '0') == '1'

        # Получаем все задачи (только корневые — без подзадач)
        all_tasks = TasksService.get_project_tasks(
            project_id,
            user_data["user_id"],
            include_tags=False,
            include_custom_fields=False,
        )

        if task_ids:
            # Выделенные задачи — точный список
            all_tasks = [t for t in all_tasks if t['id'] in set(task_ids)]
        else:
            # Применяем фильтры если есть
            if status_ids:
                all_tasks = [t for t in all_tasks if t.get('status_id') in set(status_ids)]
            if priorities:
                all_tasks = [t for t in all_tasks if t.get('priority') in set(priorities)]
            if assignee_ids is not None or include_unassigned:
                def assignee_match(t):
                    aid = t.get('assignee_id')
                    if aid is None:
                        return include_unassigned
                    return assignee_ids and aid in set(assignee_ids)
                all_tasks = [t for t in all_tasks if assignee_match(t)]

        cf_defs = CustomFieldsService.get_project_fields(project_id, user_data["user_id"], active_only=True)
        cf_values = CustomFieldsService.get_all_task_values_for_project(project_id)

        buf = export_tasks_to_excel(all_tasks, cf_defs, cf_values, lang=lang)

        return send_file(
            buf,
            as_attachment=True,
            download_name=f"tasks_project_{project_id}.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
