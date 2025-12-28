"""
Flask blueprint: /api/Dashboard/OrdersSummary
Возвращает упрощенные данные по незавершенным заказам для дашборда.
"""

from flask import Blueprint, jsonify, request
from ..service.OrdersSummary_service import get_dashboard_orders_summary
from Back.Users.service.auth_service import verify_jwt_token

bp = Blueprint("dashboard_orders_summary", __name__, url_prefix="/api/Dashboard")


@bp.route("/OrdersSummary", methods=["GET"])
def dashboard_orders_summary_endpoint() -> tuple:
    """
    Пример:
        GET /api/Dashboard/OrdersSummary
    
    Headers:
        Authorization: Bearer <token>
    
    Возвращает незавершенные заказы, сгруппированные по рынкам.
    Применяет фильтры из отчета ReportID=1.
    """
    try:
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "Токен не предоставлен"}), 401
        
        token = auth_header.split(' ')[1]
        user_data = verify_jwt_token(token)
        
        if not user_data:
            return jsonify({"error": "Невалидный токен"}), 401
        
        data = get_dashboard_orders_summary(user_data['user_id'])
        return jsonify(data), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


def init_app(app) -> None:
    """Регистрирует blueprint в приложении Flask."""
    app.register_blueprint(bp)

