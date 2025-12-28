"""
API endpoint для получения данных по месяцам (отгрузка + факт производства) для Dashboard Regions.
"""

from flask import Blueprint, jsonify, request
from ..service.RegionsMonthlyData_service import get_regions_monthly_data

bp = Blueprint("dashboard_regions_monthly_data", __name__, url_prefix="/api/Dashboard")

@bp.route("/RegionsMonthlyData", methods=["GET"])
def dashboard_regions_monthly_data_endpoint() -> tuple:
    """
    Возвращает данные по месяцам за текущий год:
    - Отгрузки (с применением опубликованных правил фильтрации)
    - Факт производства
    
    Параметры:
    - year: год (опционально, по умолчанию текущий год)
    
    Returns:
        JSON массив объектов с полями:
        - month: номер месяца (1-12)
        - month_name: название месяца (Jan, Feb, ...)
        - shipment: сумма отгрузок за месяц
        - production_fact: факт производства за месяц
    """
    try:
        year_param = request.args.get("year", type=int)
        data = get_regions_monthly_data(year=year_param)
        return jsonify(data), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

def init_app(app) -> None:
    app.register_blueprint(bp)

