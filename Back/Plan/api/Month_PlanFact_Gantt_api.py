# Month_PlanFact_Gantt_api.py
"""Flask blueprint: /api/planfact – отдаёт план/факт за месяц.

Зависит от сервис‑слоя *Month_PlanFact_Gantt_api.py* (функция
`fetch_month_planfact`).
"""

from datetime import date

from flask import Blueprint, jsonify, request

from Plan.service.Month_PlanFact_Gantt_service import fetch_month_planfact  # исправленный импорт

bp = Blueprint("planfact", __name__, url_prefix="/api")


@bp.route("/MonthPlanFactGantt", methods=["GET"])
def month_planfact_gantt_endpoint():
    """/api/MonthPlanFactGantt?year=YYYY&month=M → JSON.
    Если параметры не заданы, берётся текущий год/месяц."""
    try:
        today = date.today()
        year = int(request.args.get("year", today.year))
        month = int(request.args.get("month", today.month))

        return jsonify(fetch_month_planfact(year, month))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def init_app(app):
    """Подключает blueprint в factory‑функции."""
    app.register_blueprint(bp)
