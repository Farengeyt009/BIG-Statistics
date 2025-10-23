"""
Flask API: согласования задач
"""
from flask import Blueprint, jsonify, request
from ..service.approvals_service import ApprovalsService
from Back.Users.service.auth_service import verify_jwt_token

bp = Blueprint("task_manager_approvals", __name__, url_prefix="/api/task-manager/approvals")


def get_current_user():
    """Получить текущего пользователя"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ')[1]
    return verify_jwt_token(token)


@bp.route("/task/<int:task_id>", methods=["GET"])
def get_task_approvals(task_id):
    """Получить согласования задачи"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        approvals = ApprovalsService.get_task_approvals(task_id, user_data["user_id"])
        return jsonify({"success": True, "data": approvals}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/task/<int:task_id>", methods=["POST"])
def add_approval(task_id):
    """Согласовать задачу"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        data = request.get_json() or {}
        approval_id = ApprovalsService.add_approval(
            task_id=task_id,
            user_id=user_data["user_id"],
            comment=data.get('comment')
        )
        
        return jsonify({
            "success": True,
            "message": "Задача согласована",
            "data": {"id": approval_id}
        }), 201
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/task/<int:task_id>", methods=["DELETE"])
def remove_approval(task_id):
    """Отозвать согласование"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        ApprovalsService.remove_approval(task_id, user_data["user_id"])
        return jsonify({"success": True, "message": "Согласование отозвано"}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def init_app(app):
    """Регистрация blueprint"""
    app.register_blueprint(bp)

