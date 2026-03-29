from flask import Blueprint, jsonify, request
from ..service.LQCSummary_service import fetch_lqc_summary

bp = Blueprint("qc_lqc_summary", __name__, url_prefix="/api/qc")


@bp.route("/lqc-summary", methods=["GET"])
def lqc_summary_endpoint():
    date_from = request.args.get("date_from")
    date_to   = request.args.get("date_to")
    try:
        data = fetch_lqc_summary(date_from=date_from, date_to=date_to)
        return jsonify({"success": True, "data": data}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


def init_app(app) -> None:
    app.register_blueprint(bp)
