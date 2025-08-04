"""
Flask blueprint: /api/Production/Efficiency
Возвращает данные о эффективности производства из Views_For_Plan.DailyPlan_CustomWS за выбранный период
"""

from datetime import date
from flask import Blueprint, jsonify, request
from ..service.Production_Efficiency_service import get_production_efficiency_data

bp = Blueprint("production_efficiency", __name__, url_prefix="/api")


@bp.route("/Production/Efficiency", methods=["GET"])
def production_efficiency_endpoint():
    """
    Пример:
        GET /api/Production/Efficiency?start_date=2025-01-01&end_date=2025-01-31
        GET /api/Production/Efficiency?start_date=2025-07-21&end_date=2025-07-21
    
    Параметры:
        start_date: Начальная дата (YYYY-MM-DD)
        end_date: Конечная дата (YYYY-MM-DD)
    
    Возвращает:
        {
            "data": [...], // данные о эффективности производства
            "start_date": "2025-07-21",
            "end_date": "2025-07-21"
        }
    """
    start_date_param = request.args.get("start_date")
    end_date_param = request.args.get("end_date")
    
    # Проверяем наличие обязательных параметров
    if not start_date_param or not end_date_param:
        return jsonify({"error": "Необходимо указать параметры start_date и end_date"}), 400
    
    try:
        start_date = date.fromisoformat(start_date_param)
        end_date = date.fromisoformat(end_date_param)
    except ValueError:
        return jsonify({"error": "Неверный формат даты. Используйте YYYY-MM-DD"}), 400
    
    # Проверяем, что начальная дата не позже конечной
    if start_date > end_date:
        return jsonify({"error": "Начальная дата не может быть позже конечной даты"}), 400
    
    try:
        data = get_production_efficiency_data(start_date, end_date)
        return jsonify(data), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


def init_app(app):
    """Регистрирует blueprint в factory-функции Flask-приложения."""
    app.register_blueprint(bp) 