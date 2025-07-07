# Month_PlanFact_Gantt_api.py
"""Flask blueprint: /api/planfact – отдаёт план/факт за месяц.

Зависит от сервис‑слоя *Month_PlanFact_Gantt_api.py* (функция
`fetch_month_planfact`).
"""

from datetime import date

from flask import Blueprint, jsonify, request

from Plan.service.Month_PlanFact_Gantt_service import fetch_month_planfact  # исправленный импорт

bp = Blueprint("planfact", __name__, url_prefix="/api")


@bp.route("/planfact", methods=["GET"])
def planfact_endpoint():
    """/api/planfact?year=YYYY&month=M → JSON.
    Если параметры не заданы, берётся текущий год/месяц."""
    today = date.today()
    year = int(request.args.get("year", today.year))
    month = int(request.args.get("month", today.month))

    return jsonify(fetch_month_planfact(year, month))


def init_app(app):
    """Подключает blueprint в factory‑функции."""
    app.register_blueprint(bp)
