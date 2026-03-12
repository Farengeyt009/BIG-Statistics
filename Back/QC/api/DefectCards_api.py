"""
Flask blueprint: /api/qc/defect-cards
Returns defect cards log from QC.QC_Cards_Summary.
"""

from flask import Blueprint, jsonify, request

from ..service.DefectCards_service import fetch_defect_cards

bp = Blueprint("qc_defect_cards", __name__, url_prefix="/api/qc")


@bp.route("/defect-cards", methods=["GET"])
def defect_cards_endpoint():
    """
    GET /api/qc/defect-cards
    Optional query params:
        date_from  — YYYY-MM-DD  (filter Create_Date >=)
        date_to    — YYYY-MM-DD  (filter Create_Date <=)
    """
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")

    try:
        data = fetch_defect_cards(date_from=date_from, date_to=date_to)
        return jsonify({"success": True, "data": data}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


def init_app(app) -> None:
    app.register_blueprint(bp)
