"""
Flask API: Статистика заказов (Order Statistics)
Всегда использует стандартный фильтр с ReportID = 1
"""

from flask import Blueprint, jsonify, request
from Back.Users.service.auth_service import verify_jwt_token
from ...service.OrderData.OrderStatistics_service import (
    get_statistics_data,
    get_statistics_metadata
)

bp = Blueprint("order_statistics", __name__, url_prefix="/api/orders/statistics")


@bp.route("/data", methods=["GET"])
def get_data():
    """
    GET /api/orders/statistics/data
    
    Возвращает данные статистики заказов с применением стандартного фильтра (ReportID = 1).
    Данные используются для построения графиков и сводных таблиц.
    
    Headers:
        Authorization: Bearer <token>
    
    Response:
        {
            "success": true,
            "report_id": 1,
            "report_name": "Все заказы",
            "columns": ["OrderDate", "Market", "Total_Order_QTY", ...],
            "data": [...],
            "total_records": 1000
        }
    """
    try:
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"success": False, "error": "Токен не предоставлен"}), 401
        
        token = auth_header.split(' ')[1]
        user_data = verify_jwt_token(token)
        
        if not user_data:
            return jsonify({"success": False, "error": "Невалидный токен"}), 401
        
        # Получаем данные статистики (с фильтром ReportID = 1)
        result = get_statistics_data(user_data['user_id'])
        
        return jsonify({"success": True, **result}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Ошибка сервера: {str(e)}"}), 500


@bp.route("/grouped-table", methods=["GET"])
def get_grouped_table():
    """
    GET /api/orders/statistics/grouped-table
    
    Возвращает данные для таблицы с группировкой по Market -> LargeGroup -> GroupName.
    Только записи где RemainingToProduce_QTY > 0.
    
    Поля: Market, LargeGroup, GroupName, AggregatedShipmentDate, RemainingToProduce_QTY
    
    Headers:
        Authorization: Bearer <token>
    
    Response:
        {
            "success": true,
            "data": [...],
            "total_records": 500
        }
    """
    try:
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"success": False, "error": "Токен не предоставлен"}), 401
        
        token = auth_header.split(' ')[1]
        user_data = verify_jwt_token(token)
        
        if not user_data:
            return jsonify({"success": False, "error": "Невалидный токен"}), 401
        
        # Дополнительный фильтр: RemainingToProduce_QTY > 0
        additional_filters = [
            {
                "field": "RemainingToProduce_QTY",
                "operator": "greater_than",
                "value": "0"
            }
        ]
        
        # Получаем данные с фильтром (используем отчет ReportID=1)
        result = get_statistics_data(user_data['user_id'], additional_filters)
        
        return jsonify({"success": True, **result}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Ошибка сервера: {str(e)}"}), 500


@bp.route("/metadata", methods=["GET"])
def get_metadata():
    """
    GET /api/orders/statistics/metadata
    
    Возвращает метаданные для статистики (список полей, типы данных).
    
    Headers:
        Authorization: Bearer <token>
    
    Response:
        {
            "success": true,
            "fields": [
                {"name": "OrderDate", "type": "datetime"},
                {"name": "Market", "type": "str"},
                ...
            ],
            "total_fields": 35
        }
    """
    try:
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"success": False, "error": "Токен не предоставлен"}), 401
        
        token = auth_header.split(' ')[1]
        user_data = verify_jwt_token(token)
        
        if not user_data:
            return jsonify({"success": False, "error": "Невалидный токен"}), 401
        
        # Получаем метаданные
        result = get_statistics_metadata()
        
        return jsonify({"success": True, **result}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Ошибка сервера: {str(e)}"}), 500


def init_app(app):
    """Регистрирует blueprint в Flask приложении"""
    app.register_blueprint(bp)

