from flask import Blueprint, request, jsonify
from datetime import datetime
from Back.Production.service.Time_Loss.TimeLoss_Overview_service import TimeLossOverviewService
from Back.database.db_connector import get_connection

bp = Blueprint("timeloss_dashboard", __name__, url_prefix="/api")


@bp.route('/timeloss/dashboard')
def timeloss_dashboard_endpoint():
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    if not date_from or not date_to:
        return jsonify({'error': 'Invalid date_from/date_to'}), 400
    try:
        d_from = datetime.strptime(date_from, '%Y-%m-%d').date()
        d_to = datetime.strptime(date_to, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date_from/date_to'}), 400
    if d_from > d_to:
        return jsonify({'error': 'Invalid date_from/date_to'}), 400

    try:
        service = TimeLossOverviewService(get_connection())
        data = service.get_dashboard(d_from, d_to)
        return jsonify(data)
    except Exception as exc:
        # Временно отдаём текст ошибки для диагностики
        return jsonify({'error': 'INTERNAL_SERVER_ERROR', 'detail': str(exc)}), 500


def init_app(app):
    app.register_blueprint(bp)


