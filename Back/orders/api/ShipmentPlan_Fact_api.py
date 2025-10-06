"""
Flask blueprint for Orders.ShipmentPlan_Fact

Endpoint:
  GET /api/Orders/ShipmentPlanFact?year=YYYY&month=MM
"""

from flask import Blueprint, jsonify, request
from datetime import date

from ..service.ShipmentPlan_Fact_service import get_shipment_plan_fact

bp = Blueprint("orders_shipment_plan_fact", __name__, url_prefix="/api")


@bp.route("/Orders/ShipmentPlanFact", methods=["GET"])
def shipment_plan_fact_endpoint():
    today = date.today()
    try:
        year = int(request.args.get("year", today.year))
        month = int(request.args.get("month", today.month))
        to_year_param = request.args.get("to_year")
        to_month_param = request.args.get("to_month")
        to_year = int(to_year_param) if to_year_param is not None else None
        to_month = int(to_month_param) if to_month_param is not None else None
    except Exception:
        return jsonify({"error": "Invalid year/month"}), 400

    try:
        payload = get_shipment_plan_fact(year, month, to_year=to_year, to_month=to_month)
        return jsonify(payload), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


def init_app(app):
    app.register_blueprint(bp)


