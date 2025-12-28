"""
API для получения данных Sale Plan
"""
from flask import Blueprint, jsonify, request
from ...service.SalePlan.SalePlan_Upload_service import get_versions
from ...service.SalePlan.SalePlan_service import set_active_version, delete_version
from ...service.SalePlan.SalePlan_Analytics_service import get_version_analytics, get_version_export_data
from ...service.SalePlan.SalePlan_Data_service import get_active_version_data
from ...service.SalePlan.SalePlan_PlanVsFact_service import get_plan_vs_fact_data

bp = Blueprint('saleplan', __name__, url_prefix='/api/orders/saleplan')


@bp.route('/versions', methods=['GET'])
def get_versions_endpoint():
    """Получить список всех версий Sale Plan"""
    try:
        versions = get_versions()
        return jsonify({
            'success': True,
            'versions': versions,
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
        }), 500


@bp.route('/versions/<int:version_id>/set-active', methods=['POST'])
def set_active_endpoint(version_id: int):
    """
    Установить версию как активную
    Автоматически снимает флаг с других версий этого же года
    """
    try:
        result = set_active_version(version_id)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
        }), 500


@bp.route('/versions/<int:version_id>', methods=['DELETE'])
def delete_version_endpoint(version_id: int):
    """Удалить версию Sale Plan"""
    try:
        result = delete_version(version_id)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
        }), 500


@bp.route('/versions/<int:version_id>/analytics', methods=['GET'])
def get_analytics_endpoint(version_id: int):
    """Получить краткую аналитику по версии"""
    try:
        result = get_version_analytics(version_id)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
        }), 500


@bp.route('/versions/<int:version_id>/export', methods=['GET'])
def get_export_endpoint(version_id: int):
    """Получить полные данные версии для экспорта"""
    try:
        data = get_version_export_data(version_id)
        return jsonify({
            'success': True,
            'data': data,
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
        }), 500


@bp.route('/year/<int:year>', methods=['GET'])
def get_year_data_endpoint(year: int):
    """Получить данные активной версии для указанного года"""
    try:
        result = get_active_version_data(year)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
        }), 500


@bp.route('/planvsfact/<int:year>', methods=['GET'])
def get_plan_vs_fact_endpoint(year: int):
    """Получить данные Plan vs Fact для указанного года"""
    try:
        from Back.Users.service.auth_service import verify_jwt_token
        
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'success': False, 'error': 'Токен не предоставлен'}), 401
        
        token = auth_header.split(' ')[1]
        user_data = verify_jwt_token(token)
        
        if not user_data:
            return jsonify({'success': False, 'error': 'Невалидный токен'}), 401
        
        result = get_plan_vs_fact_data(year, user_data['user_id'])
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
        }), 500


def init_app(app):
    app.register_blueprint(bp)

