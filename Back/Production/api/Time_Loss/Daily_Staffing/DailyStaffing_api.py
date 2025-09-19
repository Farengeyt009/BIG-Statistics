from flask import Blueprint, request, jsonify
from datetime import datetime
from Back.database.db_connector import get_connection
from Back.Production.service.Time_Loss.Daily_Staffing.DailyStaffing_service import DailyStaffingService


bp_daily_staffing = Blueprint('daily_staffing', __name__, url_prefix='/api')


@bp_daily_staffing.route('/timeloss/daily-staffing')
def get_daily_staffing():
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    if not date_from or not date_to:
        return jsonify({'error': 'Invalid date_from/date_to'}), 400
    try:
        datetime.strptime(date_from, '%Y-%m-%d').date()
        datetime.strptime(date_to, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date_from/date_to'}), 400
    if date_from > date_to:
        return jsonify({'error': 'Invalid date_from/date_to'}), 400

    try:
        service = DailyStaffingService(get_connection())
        data = service.get_daily_staffing(date_from, date_to)
        return jsonify(data)
    except Exception as exc:
        return jsonify({'error': 'INTERNAL_SERVER_ERROR', 'detail': str(exc)}), 500


def init_app(app):
    app.register_blueprint(bp_daily_staffing)


