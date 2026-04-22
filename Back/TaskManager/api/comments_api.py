"""
Flask API: управление комментариями Task Manager
"""
from flask import Blueprint, jsonify, request
from ..service.comments_service import CommentsService
from Back.Users.service.auth_service import verify_jwt_token

bp = Blueprint("task_manager_comments", __name__, url_prefix="/api/task-manager/comments")


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


@bp.route("/task/<int:task_id>", methods=["GET"])
def get_task_comments(task_id):
    """Получить все комментарии задачи"""
    started = None
    try:
        user_data = get_current_user()
        if not user_data:
            return _perf_response({"success": False, "error": "Не авторизован"}, 401, started, "GET /comments/task/:id")
        
        comments = CommentsService.get_task_comments(task_id, user_data["user_id"])
        return _perf_response({"success": True, "data": comments}, 200, started, "GET /comments/task/:id")
    except PermissionError as e:
        return _perf_response({"success": False, "error": str(e)}, 403, started, "GET /comments/task/:id")
    except Exception as e:
        return _perf_response({"success": False, "error": str(e)}, 500, started, "GET /comments/task/:id")


@bp.route("/", methods=["POST"])
def create_comment():
    """Создать комментарий"""
    started = None
    try:
        user_data = get_current_user()
        if not user_data:
            return _perf_response({"success": False, "error": "Не авторизован"}, 401, started, "POST /comments")
        
        data = request.get_json()
        if not data or not data.get('task_id') or not data.get('comment'):
            return _perf_response({"success": False, "error": "task_id и comment обязательны"}, 400, started, "POST /comments")
        
        comment_id = CommentsService.create_comment(
            task_id=data.get('task_id'),
            user_id=user_data["user_id"],
            comment=data.get('comment')
        )
        
        return _perf_response({
            "success": True,
            "message": "Комментарий добавлен",
            "data": {"id": comment_id}
        }, 201, started, "POST /comments")
    except PermissionError as e:
        return _perf_response({"success": False, "error": str(e)}, 403, started, "POST /comments")
    except Exception as e:
        return _perf_response({"success": False, "error": str(e)}, 500, started, "POST /comments")


@bp.route("/<int:comment_id>", methods=["PUT"])
def update_comment(comment_id):
    """Обновить комментарий"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        data = request.get_json()
        if not data or not data.get('comment'):
            return jsonify({"success": False, "error": "comment обязательно"}), 400
        
        CommentsService.update_comment(
            comment_id=comment_id,
            user_id=user_data["user_id"],
            comment=data.get('comment')
        )
        
        return jsonify({"success": True, "message": "Комментарий обновлен"}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/<int:comment_id>", methods=["DELETE"])
def delete_comment(comment_id):
    """Удалить комментарий"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        CommentsService.delete_comment(comment_id, user_data["user_id"])
        return jsonify({"success": True, "message": "Комментарий удален"}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def init_app(app):
    """Регистрация blueprint в приложении"""
    app.register_blueprint(bp)
