from flask import Blueprint, jsonify, request

from ...service.Working_Calendar.WorkSchedules_ByDay_service import (
    get_work_schedules_by_day,
    bulk_replace_work_schedules_by_day,
    soft_delete_work_schedule_line,
)

bp = Blueprint("work_schedules_by_day", __name__, url_prefix="/api")


@bp.route("/work-schedules/day", methods=["GET"])
def get_day_work_schedules_endpoint():
    try:
        date_param = request.args.get("date")
        if not date_param:
            return jsonify({"success": False, "message": "Parameter 'date' is required (YYYY-MM-DD)"}), 400

        work_shop_id = request.args.get("workShopId")
        work_center_id = request.args.get("workCenterId")

        data = get_work_schedules_by_day(date_param, work_shop_id, work_center_id)
        return jsonify({"success": True, "data": data}), 200
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


@bp.route("/work-schedules/day/bulk-replace", methods=["POST"])
def bulk_replace_day_work_schedules_endpoint():
    try:
        payload = request.get_json(silent=True) or {}
        date_param = payload.get("date")
        items = payload.get("items") or []

        if not date_param:
            return jsonify({"success": False, "message": "Field 'date' is required (YYYY-MM-DD)"}), 400
        if not isinstance(items, list):
            return jsonify({"success": False, "message": "Field 'items' must be an array"}), 400

        result = bulk_replace_work_schedules_by_day(date_param, items)
        return jsonify(result), 200
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


@bp.route("/work-schedules/line/soft-delete", methods=["POST"])
def soft_delete_line_endpoint():
    try:
        payload = request.get_json(silent=True) or {}
        line_id = payload.get("lineId")
        if not line_id:
            return jsonify({"success": False, "message": "Field 'lineId' is required"}), 400

        result = soft_delete_work_schedule_line(line_id)
        return jsonify(result), 200
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


def init_app(app):
    app.register_blueprint(bp)


