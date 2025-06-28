from ..service.uncompleted_orders_table import get_all_uncompleted_orders_table
from flask import Blueprint, jsonify

uncompleted_orders_table_bp = Blueprint('uncompleted_orders_table', __name__)

@uncompleted_orders_table_bp.route('/api/uncompleted-orders/table', methods=['GET'])
def get_table():
    result = get_all_uncompleted_orders_table()
    return jsonify(result)
