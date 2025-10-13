"""
Flask API: управление пользовательскими отчетами заказов
"""

from flask import Blueprint, jsonify, request
from Back.Users.service.auth_service import verify_jwt_token
from ...service.OrderData.OrderData_service import (
    get_user_reports,
    create_report,
    update_report,
    delete_report,
    execute_report,
    get_available_fields
)

bp = Blueprint("order_data_reports", __name__, url_prefix="/api/orders/reports")


@bp.route("/list", methods=["GET"])
def list_reports():
    """
    GET /api/orders/reports/list
    
    Headers:
        Authorization: Bearer <token>
    
    Response:
        {
            "success": true,
            "reports": [...]
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
        
        reports = get_user_reports(user_data['user_id'])
        
        return jsonify({"success": True, "reports": reports}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Ошибка сервера: {str(e)}"}), 500


@bp.route("/create", methods=["POST"])
def create():
    """
    POST /api/orders/reports/create
    
    Headers:
        Authorization: Bearer <token>
    
    Body:
        {
            "report_name": "Мой отчет",
            "source_table": "Orders.Orders_1C_Svod",
            "selected_fields": ["Order_No", "Market", ...],
            "filters": {"Market": {"operator": "equals", "value": "China"}}
        }
    
    Response:
        {
            "success": true,
            "report": {...}
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
        
        data = request.get_json()
        
        if not data:
            return jsonify({"success": False, "error": "Нет данных"}), 400
        
        report_name = data.get('report_name')
        source_table = data.get('source_table', 'Orders.Orders_1C_Svod')
        selected_fields = data.get('selected_fields', [])
        filters = data.get('filters', {})
        grouping = data.get('grouping')
        
        if not report_name:
            return jsonify({"success": False, "error": "Название отчета обязательно"}), 400
        
        report = create_report(
            user_id=user_data['user_id'],
            report_name=report_name,
            source_table=source_table,
            selected_fields=selected_fields,
            filters=filters,
            grouping=grouping
        )
        
        return jsonify({"success": True, "report": report, "message": "Отчет создан успешно"}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Ошибка сервера: {str(e)}"}), 500


@bp.route("/<int:report_id>", methods=["PUT"])
def update(report_id: int):
    """
    PUT /api/orders/reports/{report_id}
    
    Headers:
        Authorization: Bearer <token>
    
    Body:
        {
            "report_name": "Новое название",
            "selected_fields": [...],
            "filters": {...}
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
        
        data = request.get_json()
        
        report = update_report(
            report_id=report_id,
            user_id=user_data['user_id'],
            report_name=data.get('report_name'),
            selected_fields=data.get('selected_fields'),
            filters=data.get('filters'),
            grouping=data.get('grouping'),
            is_admin=user_data.get('is_admin', False)
        )
        
        return jsonify({"success": True, "report": report, "message": "Отчет обновлен успешно"}), 200
        
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": f"Ошибка сервера: {str(e)}"}), 500


@bp.route("/<int:report_id>", methods=["DELETE"])
def delete(report_id: int):
    """
    DELETE /api/orders/reports/{report_id}
    
    Headers:
        Authorization: Bearer <token>
    """
    try:
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"success": False, "error": "Токен не предоставлен"}), 401
        
        token = auth_header.split(' ')[1]
        user_data = verify_jwt_token(token)
        
        if not user_data:
            return jsonify({"success": False, "error": "Невалидный токен"}), 401
        
        delete_report(report_id, user_data['user_id'], user_data.get('is_admin', False))
        
        return jsonify({"success": True, "message": "Отчет удален успешно"}), 200
        
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": f"Ошибка сервера: {str(e)}"}), 500


@bp.route("/<int:report_id>/execute", methods=["POST"])
def execute(report_id: int):
    """
    POST /api/orders/reports/{report_id}/execute
    
    Headers:
        Authorization: Bearer <token>
    
    Response:
        {
            "success": true,
            "report_id": 1,
            "report_name": "Мой отчет",
            "columns": ["Order_No", "Market", ...],
            "data": [...],
            "total_records": 100
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
        
        result = execute_report(report_id, user_data['user_id'])
        
        return jsonify({"success": True, **result}), 200
        
    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 404
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": f"Ошибка выполнения отчета: {str(e)}"}), 500


@bp.route("/<int:report_id>", methods=["GET"])
def get_report(report_id: int):
    """
    GET /api/orders/reports/{report_id}
    
    Headers:
        Authorization: Bearer <token>
    
    Response:
        {
            "success": true,
            "report": {...}
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
        
        # Получаем отчет из списка пользователя
        reports = get_user_reports(user_data['user_id'])
        report = next((r for r in reports if r['report_id'] == report_id), None)
        
        if not report:
            return jsonify({"success": False, "error": "Отчет не найден"}), 404
        
        return jsonify({"success": True, "report": report}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Ошибка сервера: {str(e)}"}), 500


@bp.route("/fields", methods=["GET"])
def get_fields():
    """
    GET /api/orders/reports/fields?source_table=Orders.Orders_1C_Svod
    
    Headers:
        Authorization: Bearer <token>
    
    Response:
        {
            "success": true,
            "fields": [
                {"name": "Order_No", "type": "str"},
                {"name": "Market", "type": "str"},
                ...
            ]
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
        
        source_table = request.args.get('source_table', 'Orders.Orders_1C_Svod')
        
        fields = get_available_fields(source_table)
        
        return jsonify({"success": True, "fields": fields}), 200
        
    except Exception as e:
        return jsonify({"success": False, "error": f"Ошибка сервера: {str(e)}"}), 500


def init_app(app):
    """Регистрирует blueprint в Flask приложении"""
    app.register_blueprint(bp)

