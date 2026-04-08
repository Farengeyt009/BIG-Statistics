"""
Flask blueprint for Migration monitoring API.
All routes require admin permission.

Routes:
  GET  /api/migration/status                 — list all scripts + status
  GET  /api/migration/logs/<script_id>       — last N log lines
  POST /api/migration/restart/<script_id>    — request restart
  POST /api/migration/stop/<script_id>       — request stop
  POST /api/migration/run-now/<script_id>    — request immediate run (scheduled scripts)
"""
import traceback
from functools import wraps
from flask import Blueprint, jsonify, request

from Back.Users.service.auth_service import verify_jwt_token
from Back.Migration.service.migration_service import (
    get_all_statuses,
    get_script_logs,
    request_restart,
    request_stop,
    request_run_now,
)

migration_bp = Blueprint("migration", __name__, url_prefix="/api/migration")


def _require_admin(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Token not provided"}), 401
        token = auth_header.split(" ", 1)[1]
        user_data = verify_jwt_token(token)
        if not user_data:
            return jsonify({"error": "Invalid token"}), 401
        if not user_data.get("is_admin"):
            return jsonify({"error": "Admin access required"}), 403
        return f(user_data, *args, **kwargs)
    return wrapper


@migration_bp.route("/status", methods=["GET"])
@_require_admin
def get_status(current_user):
    try:
        data = get_all_statuses()
        return jsonify(data), 200
    except Exception:
        return jsonify({"error": traceback.format_exc()}), 500


@migration_bp.route("/logs/<script_id>", methods=["GET"])
@_require_admin
def get_logs(current_user, script_id):
    try:
        lines = int(request.args.get("lines", 100))
        data = get_script_logs(script_id, lines)
        return jsonify({"script_id": script_id, "lines": data}), 200
    except Exception:
        return jsonify({"error": traceback.format_exc()}), 500


@migration_bp.route("/restart/<script_id>", methods=["POST"])
@_require_admin
def restart_script(current_user, script_id):
    try:
        result = request_restart(script_id)
        status = 200 if result.get("success") else 500
        return jsonify(result), status
    except Exception:
        return jsonify({"error": traceback.format_exc()}), 500


@migration_bp.route("/stop/<script_id>", methods=["POST"])
@_require_admin
def stop_script(current_user, script_id):
    try:
        result = request_stop(script_id)
        status = 200 if result.get("success") else 500
        return jsonify(result), status
    except Exception:
        return jsonify({"error": traceback.format_exc()}), 500


@migration_bp.route("/run-now/<script_id>", methods=["POST"])
@_require_admin
def run_now_script(current_user, script_id):
    try:
        result = request_run_now(script_id)
        status = 200 if result.get("success") else 500
        return jsonify(result), status
    except Exception:
        return jsonify({"error": traceback.format_exc()}), 500


def init_app(app):
    app.register_blueprint(migration_bp)
