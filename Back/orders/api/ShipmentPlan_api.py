from flask import Blueprint, jsonify, request
from typing import Any, Dict

from ..service.ShipmentPlan_service import upsert_shipment_plan

bp = Blueprint("orders_shipment_plan", __name__, url_prefix="/api")


@bp.route("/Orders/ShipmentPlan", methods=["POST"])
def upsert_shipment_plan_endpoint():
    try:
        body = request.get_json(force=True, silent=False)
    except Exception:
        return jsonify({"error": "Invalid JSON"}), 400

    updated_by = request.headers.get("X-User", "webapp")

    def handle_one(obj: Dict[str, Any]):
        if not isinstance(obj, dict):
            raise ValueError("Each item must be an object")
        if "PeriodID" not in obj:
            raise ValueError("PeriodID is required")
        period_id = int(obj["PeriodID"])
        payload = {k: v for k, v in obj.items() if k != "PeriodID"}
        return upsert_shipment_plan(period_id=period_id, payload=payload, updated_by=updated_by)

    try:
        if isinstance(body, list):
            result = [handle_one(item) for item in body]
            return jsonify({"updated": len(result), "data": result}), 200
        else:
            result = handle_one(body)
            return jsonify({"updated": 1, "data": result}), 200
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as exc:
        return jsonify({"error": f"Failed to upsert Shipment_Plan: {exc}"}), 500


def init_app(app):
    app.register_blueprint(bp)


