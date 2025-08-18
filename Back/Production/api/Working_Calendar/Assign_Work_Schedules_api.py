"""
Flask blueprint: /api/Production/AssignWorkSchedules
Возвращает данные для модального окна "Assign Work Schedules"
"""

from datetime import date
from flask import Blueprint, jsonify, request
from ...service.Working_Calendar.Assign_Work_Schedules_service import (
    get_assign_work_schedules_data_by_date_string
)

bp = Blueprint("assign_work_schedules", __name__, url_prefix="/api")


@bp.route("/Production/AssignWorkSchedules", methods=["GET"])
def assign_work_schedules_endpoint():
    """
    Примеры:
        GET /api/Production/AssignWorkSchedules?date=2025-08-01
    
    Параметры:
        date: Дата в формате YYYY-MM-DD (обязательный)
    
    Возвращает:
        {
            "table1": [...], // Данные о цехах и рабочих центрах
            "table2": [...], // Данные о назначениях (будет добавлено позже)
            "table3": [...], // Дополнительные данные (будет добавлено позже)
            "selected_date": "01.08.2025",
            "total_records": {
                "table1": 10,
                "table2": 0,
                "table3": 0
            }
        }
    """
    
    # Получаем параметр даты
    date_param = request.args.get("date")
    
    # Проверяем наличие обязательного параметра
    if not date_param:
        return jsonify({
            "error": "Необходимо указать параметр date. Пример: ?date=2025-08-01"
        }), 400
    
    # Валидируем формат даты
    try:
        selected_date = date.fromisoformat(date_param)
    except ValueError:
        return jsonify({
            "error": "Неверный формат даты. Используйте формат YYYY-MM-DD. Пример: 2025-08-01"
        }), 400
    
    # Проверяем, что дата не в будущем (опционально)
    from datetime import date as current_date
    if selected_date > current_date.today():
        return jsonify({
            "error": "Дата не может быть в будущем"
        }), 400
    
    try:
        # Получаем данные через service
        data = get_assign_work_schedules_data_by_date_string(date_param)
        return jsonify(data), 200
        
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


def init_app(app):
    """Регистрирует blueprint в factory-функции Flask-приложения."""
    app.register_blueprint(bp)
