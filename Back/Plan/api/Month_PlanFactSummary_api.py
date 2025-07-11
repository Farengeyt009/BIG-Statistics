"""
Flask blueprint: /api/MonthPlanFactSummary
Возвращает JSON с тремя агрегатами «план/факт» за выбранный месяц.
"""

from datetime import date

from flask import Blueprint, jsonify, request

# ◀─ относительный импорт: мы находимся в Back.Plan.api
from ..service.Month_PlanFactSummary_service import fetch_planfact_summary

bp = Blueprint("planfact_summary", __name__, url_prefix="/api")


@bp.route("/MonthPlanFactSummary", methods=["GET"])
def month_planfact_summary_endpoint() -> tuple:
    """
    Пример:
        GET /api/MonthPlanFactSummary?year=2025&month=1
    Если параметры не заданы, берётся текущий год/месяц.
    """
    today = date.today()
    year = int(request.args.get("year", today.year))
    month = int(request.args.get("month", today.month))

    try:
        data = fetch_planfact_summary(year, month)
        return jsonify(data), 200
    except Exception as exc:                        # ← логируем по-желанию
        return jsonify({"error": str(exc)}), 500


def init_app(app) -> None:
    """Регистрирует blueprint в factory-функции Flask-приложения."""
    app.register_blueprint(bp)
