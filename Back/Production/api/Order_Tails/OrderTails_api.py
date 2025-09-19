from flask import Blueprint, jsonify
from Back.database.db_connector import get_connection
from Back.Production.service.Order_Tails.OrderTails_service import OrderTailsService


bp_order_tails = Blueprint('order_tails', __name__, url_prefix='/api')


@bp_order_tails.route('/order-tails')
def get_order_tails():
    try:
        svc = OrderTailsService(get_connection())
        data = svc.get_order_tails()
        return jsonify(data)
    except Exception as exc:
        return jsonify({'error': 'INTERNAL_SERVER_ERROR', 'detail': str(exc)}), 500


def init_app(app):
    app.register_blueprint(bp_order_tails)


