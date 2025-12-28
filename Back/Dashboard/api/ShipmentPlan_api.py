"""
Flask blueprint: /api/Dashboard/ShipmentPlan
Возвращает данные по плану и факту отгрузки для дашборда.
"""

from flask import Blueprint, jsonify
from ..service.ShipmentPlan_service import get_dashboard_shipment_plan

bp = Blueprint("dashboard_shipment_plan", __name__, url_prefix="/api/Dashboard")


@bp.route("/ShipmentPlan", methods=["GET"])
def dashboard_shipment_plan_endpoint() -> tuple:
    """
    Пример:
        GET /api/Dashboard/ShipmentPlan
    
    Возвращает данные по плану и факту отгрузки для текущего месяца и недели.
    """
    try:
        data = get_dashboard_shipment_plan()
        return jsonify(data), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


def init_app(app) -> None:
    """Регистрирует blueprint в приложении Flask."""
    app.register_blueprint(bp)

