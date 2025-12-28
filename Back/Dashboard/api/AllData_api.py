"""
API endpoint для получения всех данных дашборда в одном запросе.
"""

from flask import Blueprint, jsonify, request
from Back.Users.service.auth_service import verify_jwt_token
from ..service.AllData_service import get_dashboard_all_data

bp = Blueprint("dashboard_all_data", __name__, url_prefix="/api/Dashboard")


@bp.route("/AllData", methods=["GET"])
def dashboard_all_data_endpoint() -> tuple:
    """
    Возвращает все данные дашборда в одном запросе.
    
    Параметры запроса:
    - year: год (опционально, по умолчанию текущий)
    - month: месяц (опционально, по умолчанию текущий)
    
    Требует JWT токен в заголовке Authorization.
    
    Returns:
        JSON объект со всеми данными дашборда
    """
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "Токен не предоставлен"}), 401
        
        token = auth_header.split(' ')[1]
        user_data = verify_jwt_token(token)
        if not user_data:
            return jsonify({"error": "Невалидный токен"}), 401
        
        year = request.args.get("year", type=int)
        month = request.args.get("month", type=int)
        
        data = get_dashboard_all_data(user_data['user_id'], year, month)
        return jsonify(data), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


def init_app(app) -> None:
    app.register_blueprint(bp)

