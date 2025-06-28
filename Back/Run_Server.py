# Run_Server.py

from flask import Flask
from flask_cors import CORS

from Back.orders.api.CustomerOrdersInformation_views import CustomerOrdersInformation_views_bp
from Back.orders.api.CustomerOrdersInformation_table import CustomerOrdersInformation_table_bp
app = Flask(__name__)
CORS(app)  # Разрешаем кросс-доменные запросы (CORS) от фронтенда

# Регистрация маршрутов
app.register_blueprint(CustomerOrdersInformation_views_bp)
app.register_blueprint(CustomerOrdersInformation_table_bp)

if __name__ == '__main__':
    app.run(debug=True)
