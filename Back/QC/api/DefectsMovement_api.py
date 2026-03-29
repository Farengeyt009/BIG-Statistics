"""
Flask blueprint: /api/qc/defects-movement
Returns defects movement log from QC.Defects_Movement.
"""

from flask import Blueprint, jsonify, request

from ..service.DefectsMovement_service import fetch_defects_movement, fetch_defects_movement_summary

bp = Blueprint("qc_defects_movement", __name__, url_prefix="/api/qc")


@bp.route("/defects-movement", methods=["GET"])
def defects_movement_endpoint():
    date_from = request.args.get("date_from")
    date_to   = request.args.get("date_to")

    try:
        data = fetch_defects_movement(date_from=date_from, date_to=date_to)
        return jsonify({"success": True, "data": data}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@bp.route("/defects-movement-summary", methods=["GET"])
def defects_movement_summary_endpoint():
    date_from = request.args.get("date_from")
    date_to   = request.args.get("date_to")

    try:
        data = fetch_defects_movement_summary(date_from=date_from, date_to=date_to)
        return jsonify({"success": True, "data": data}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


def init_app(app) -> None:
    app.register_blueprint(bp)
