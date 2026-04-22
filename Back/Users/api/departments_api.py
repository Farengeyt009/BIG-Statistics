"""
Flask API: departments directory management
"""

from functools import wraps

from flask import Blueprint, jsonify, request

from ..service.auth_service import verify_jwt_token
from ..service.departments_service import (
    assign_user_department,
    create_department,
    delete_department,
    ensure_departments_schema,
    get_department_by_id,
    get_departments,
    get_users_without_department,
    update_department,
)

bp = Blueprint("departments", __name__, url_prefix="/api/departments")


def _get_auth_user():
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ")[1]
    return verify_jwt_token(token)


def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = _get_auth_user()
        if not user:
            return jsonify({"success": False, "error": "Invalid token"}), 401
        if not user.get("is_admin"):
            return jsonify({"success": False, "error": "Admin privileges required"}), 403
        return f(*args, **kwargs)

    return decorated


@bp.route("", methods=["GET"])
def list_departments():
    """
    GET /api/departments?all=1
    - без токена: только активные
    - с админ-токеном и all=1: все
    """
    try:
        ensure_departments_schema()
        requested_all = request.args.get("all", "0") in ("1", "true", "True")
        user = _get_auth_user()
        active_only = not (requested_all and user and user.get("is_admin"))
        departments = get_departments(active_only=active_only)
        return jsonify({"success": True, "departments": departments}), 200
    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


@bp.route("", methods=["POST"])
@require_admin
def create_department_route():
    try:
        data = request.get_json() or {}
        department = create_department(
            name=data.get("name", ""),
            code=data.get("code"),
            sort_order=int(data.get("sort_order", 0)),
            is_active=bool(data.get("is_active", True)),
        )
        return jsonify({"success": True, "department": department}), 201
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        error_text = str(e).lower()
        if "uq_departments_name" in error_text:
            return jsonify({"success": False, "error": "Department name already exists"}), 409
        if "uq_departments_code" in error_text:
            return jsonify({"success": False, "error": "Department code already exists"}), 409
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


@bp.route("/<int:department_id>", methods=["PUT"])
@require_admin
def update_department_route(department_id: int):
    try:
        data = request.get_json() or {}
        department = update_department(
            department_id=department_id,
            name=data.get("name"),
            code=data.get("code"),
            is_active=data.get("is_active"),
            sort_order=data.get("sort_order"),
        )
        if not department:
            return jsonify({"success": False, "error": "Department not found"}), 404
        return jsonify({"success": True, "department": department}), 200
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        error_text = str(e).lower()
        if "uq_departments_name" in error_text:
            return jsonify({"success": False, "error": "Department name already exists"}), 409
        if "uq_departments_code" in error_text:
            return jsonify({"success": False, "error": "Department code already exists"}), 409
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


@bp.route("/<int:department_id>", methods=["DELETE"])
@require_admin
def delete_department_route(department_id: int):
    try:
        hard_delete = request.args.get("hard", "0") in ("1", "true", "True")
        result = delete_department(department_id=department_id, hard_delete=hard_delete)
        if not result["deleted"]:
            return jsonify({"success": False, "error": "Department not found"}), 404
        return jsonify({"success": True, **result}), 200
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 409
    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


@bp.route("/unassigned-users", methods=["GET"])
@require_admin
def unassigned_users_route():
    try:
        limit = request.args.get("limit", 500, type=int)
        users = get_users_without_department(limit=max(1, min(limit, 2000)))
        return jsonify({"success": True, "users": users}), 200
    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


@bp.route("/assign-user", methods=["POST"])
@require_admin
def assign_user_route():
    try:
        data = request.get_json() or {}
        user_id = int(data.get("user_id"))
        department_id = int(data.get("department_id"))
        updated = assign_user_department(user_id=user_id, department_id=department_id)
        if not updated:
            return jsonify({"success": False, "error": "User not found"}), 404
        department = get_department_by_id(department_id)
        return jsonify({"success": True, "department": department}), 200
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


def init_app(app):
    app.register_blueprint(bp)
