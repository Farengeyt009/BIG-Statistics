"""
Flask blueprint: /api/Production/WorkingCalendar
Возвращает данные рабочего календаря из Views_For_Plan.DailyPlan_CustomWS за выбранный период
"""

from datetime import date
from flask import Blueprint, jsonify, request
from ...service.Working_Calendar.WorkingCalendar_service import get_working_calendar_data, get_working_calendar_data_by_date_range

bp = Blueprint("working_calendar_data", __name__, url_prefix="/api")


@bp.route("/Production/WorkingCalendar", methods=["GET"])
def working_calendar_endpoint():
    """
    Примеры:
        GET /api/Production/WorkingCalendar?year=2025&month=5
        GET /api/Production/WorkingCalendar?start_date=2025-05-01&end_date=2025-05-31
    
    Параметры (один из вариантов):
        Вариант 1 (по году и месяцу):
            year: Год (например, 2025)
            month: Месяц (1-12)
        
        Вариант 2 (по диапазону дат):
            start_date: Начальная дата (YYYY-MM-DD)
            end_date: Конечная дата (YYYY-MM-DD)
    
    Возвращает:
        {
            "data": [...], // данные рабочего календаря
            "year": 2025, // или start_date/end_date для диапазона
            "month": 5,
            "total_records": 31
        }
    """
    
    # Проверяем параметры для фильтрации по году и месяцу
    year_param = request.args.get("year")
    month_param = request.args.get("month")
    
    # Проверяем параметры для фильтрации по диапазону дат
    start_date_param = request.args.get("start_date")
    end_date_param = request.args.get("end_date")
    
    # Определяем тип запроса
    if year_param and month_param:
        # Запрос по году и месяцу
        try:
            year = int(year_param)
            month = int(month_param)
            
            # Валидация параметров
            if year < 2020 or year > 2030:
                return jsonify({"error": "Год должен быть между 2020 и 2030"}), 400
            
            if month < 1 or month > 12:
                return jsonify({"error": "Месяц должен быть между 1 и 12"}), 400
                
        except ValueError:
            return jsonify({"error": "Неверный формат года или месяца. Используйте числа"}), 400
        
        try:
            data = get_working_calendar_data(year, month)
            return jsonify(data), 200
        except Exception as exc:
            return jsonify({"error": str(exc)}), 500
            
    elif start_date_param and end_date_param:
        # Запрос по диапазону дат
        try:
            start_date = date.fromisoformat(start_date_param)
            end_date = date.fromisoformat(end_date_param)
        except ValueError:
            return jsonify({"error": "Неверный формат даты. Используйте YYYY-MM-DD"}), 400
        
        # Проверяем, что начальная дата не позже конечной
        if start_date > end_date:
            return jsonify({"error": "Начальная дата не может быть позже конечной даты"}), 400
        
        try:
            data = get_working_calendar_data_by_date_range(start_date, end_date)
            return jsonify(data), 200
        except Exception as exc:
            return jsonify({"error": str(exc)}), 500
    else:
        # Не указаны необходимые параметры
        return jsonify({
            "error": "Необходимо указать параметры. Варианты:\n"
                     "1. year и month (например: ?year=2025&month=5)\n"
                     "2. start_date и end_date (например: ?start_date=2025-05-01&end_date=2025-05-31)"
        }), 400


def init_app(app):
    """Регистрирует blueprint в factory-функции Flask-приложения."""
    app.register_blueprint(bp)
