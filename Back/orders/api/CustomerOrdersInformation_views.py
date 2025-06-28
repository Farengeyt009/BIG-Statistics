from flask import Blueprint, jsonify
from ..service.uncompleted_orders_views import get_uncompleted_orders_views

uncompleted_orders_views_bp = Blueprint('uncompleted_orders_views', __name__)

@uncompleted_orders_views_bp.route('/api/uncompleted-orders/views', methods=['GET'])
def uncompleted_orders_views():
    return jsonify(get_uncompleted_orders_views())
