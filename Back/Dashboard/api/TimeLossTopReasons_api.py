"""
API endpoint для получения топ-5 причин потерь времени для Dashboard.
"""

from flask import Blueprint, jsonify
from ..service.TimeLossTopReasons_service import get_dashboard_timeloss_top_reasons

bp = Blueprint("dashboard_timeloss_top_reasons", __name__, url_prefix="/api/Dashboard")

@bp.route("/TimeLossTopReasons", methods=["GET"])
def dashboard_timeloss_top_reasons_endpoint() -> tuple:
    """
    Возвращает топ-5 причин потерь времени за текущий месяц и FACT_TIME для расчета эффективности.
    
    Returns:
        JSON объект с полями:
        - reasons: массив объектов с полями:
            - reason_zh: название причины на китайском
            - reason_en: название причины на английском
            - total_hours: общее количество часов
        - fact_time: итоговый FACT_TIME (Production Fact) за период
    """
    try:
        data = get_dashboard_timeloss_top_reasons()
        return jsonify(data), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

def init_app(app) -> None:
    app.register_blueprint(bp)


