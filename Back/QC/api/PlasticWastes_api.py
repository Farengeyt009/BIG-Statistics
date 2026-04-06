from flask import Blueprint, jsonify, request
from ..service.PlasticWastes_service import fetch_plastic_wastes

bp = Blueprint("qc_plastic_wastes", __name__, url_prefix="/api/qc")


@bp.route("/plastic-wastes", methods=["GET"])
def plastic_wastes_endpoint():
    date_from = request.args.get("date_from")
    date_to   = request.args.get("date_to")
    try:
        data = fetch_plastic_wastes(date_from=date_from, date_to=date_to)
        return jsonify({"success": True, "data": data}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


def init_app(app) -> None:
    app.register_blueprint(bp)
