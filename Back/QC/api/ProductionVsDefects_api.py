"""
Flask blueprint: /api/qc/production-vs-defects
Returns aggregated production output vs defect data by workshop.
"""

from flask import Blueprint, jsonify, request
from ..service.ProductionVsDefects_service import fetch_production_vs_defects

bp = Blueprint("qc_production_vs_defects", __name__, url_prefix="/api/qc")


@bp.route("/production-vs-defects", methods=["GET"])
def production_vs_defects_endpoint():
    date_from = request.args.get("date_from")
    date_to   = request.args.get("date_to")

    try:
        data = fetch_production_vs_defects(date_from=date_from, date_to=date_to)
        return jsonify({"success": True, "data": data}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


def init_app(app) -> None:
    app.register_blueprint(bp)
