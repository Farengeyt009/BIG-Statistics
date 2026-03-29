from flask import Blueprint, jsonify, request
from ..service.LQCJournal_service import fetch_lqc_journal

bp = Blueprint("qc_lqc_journal", __name__, url_prefix="/api/qc")


@bp.route("/lqc-journal", methods=["GET"])
def lqc_journal_endpoint():
    date_from = request.args.get("date_from")
    date_to   = request.args.get("date_to")
    try:
        data = fetch_lqc_journal(date_from=date_from, date_to=date_to)
        return jsonify({"success": True, "data": data}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


def init_app(app) -> None:
    app.register_blueprint(bp)
