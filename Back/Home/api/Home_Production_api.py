"""
Flask blueprint: /api/Home/Production
Возвращает данные из Views_For_Plan.DailyPlan_CustomWS и Month_PlanFact_Summary за выбранную дату
"""

from datetime import date
from flask import Blueprint, jsonify, request
from ..service.Home_Production_service import get_production_data

bp = Blueprint("home_production", __name__, url_prefix="/api")


@bp.route("/Home/Production", methods=["GET"])
def production_endpoint():
    """
    Пример:
        GET /api/Home/Production
        GET /api/Home/Production?date=2025-01-15
    
    Если параметр date не задан, возвращает данные за сегодняшний день
    
    Возвращает:
        {
            "table1": [...], // данные по цехам
            "table2": {...}, // суммарные данные за месяц
            "table3": {...}, // данные о времени (TimeLoss и FactTime)
            "table4": [...], // детальные данные + агрегаты по цехам
            "selected_date": "2025-07-13"
        }
    """
    date_param = request.args.get("date")
    
    if date_param:
        try:
            selected_date = date.fromisoformat(date_param)
        except ValueError:
            return jsonify({"error": "Неверный формат даты. Используйте YYYY-MM-DD"}), 400
    else:
        selected_date = None
    
    try:
        data = get_production_data(selected_date)
        return jsonify(data), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


def init_app(app):
    """Регистрирует blueprint в factory-функции Flask-приложения."""
    app.register_blueprint(bp) 