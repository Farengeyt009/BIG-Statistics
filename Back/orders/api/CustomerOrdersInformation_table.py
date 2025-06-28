from ..service.CustomerOrdersInformation_table import get_all_CustomerOrdersInformation_table
from flask import Blueprint, jsonify

CustomerOrdersInformation_table_bp = Blueprint('CustomerOrdersInformation_table', __name__)

@CustomerOrdersInformation_table_bp.route('/api/CustomerOrdersInformation/table', methods=['GET'])
def CustomerOrdersInformation_table():
    result = get_all_CustomerOrdersInformation_table()
    return jsonify(result)
