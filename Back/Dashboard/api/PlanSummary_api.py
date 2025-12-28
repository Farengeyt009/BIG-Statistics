"""
Flask blueprint: /api/Dashboard/PlanSummary
Возвращает упрощенные агрегаты план/факт для дашборда.
"""

from datetime import date
from flask import Blueprint, jsonify, request
from ..service.PlanSummary_service import get_dashboard_plan_summary

bp = Blueprint("dashboard_plan_summary", __name__, url_prefix="/api/Dashboard")


@bp.route("/PlanSummary", methods=["GET"])
def dashboard_plan_summary_endpoint() -> tuple:
    """
    Пример:
        GET /api/Dashboard/PlanSummary
        GET /api/Dashboard/PlanSummary?year=2025&month=1
    Если параметры не заданы, берется текущий год/месяц.
    """
    today = date.today()
    year = request.args.get("year", type=int)
    month = request.args.get("month", type=int)
    
    try:
        data = get_dashboard_plan_summary(year, month)
        return jsonify(data), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


def init_app(app) -> None:
    """Регистрирует blueprint в приложении Flask."""
    app.register_blueprint(bp)

