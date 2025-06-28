from flask import Blueprint, jsonify
from ..service.CustomerOrdersInformation_views import get_CustomerOrdersInformation_views

CustomerOrdersInformation_views_bp = Blueprint('CustomerOrdersInformation_views', __name__)

@CustomerOrdersInformation_views_bp.route('/api/CustomerOrdersInformation/views', methods=['GET'])
def get_customer_orders_information_views():
    return jsonify(get_CustomerOrdersInformation_views())
