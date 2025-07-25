# Run_Server.py

from flask import Flask
from flask_cors import CORS

from Back.orders.api.CustomerOrdersInformation_views import CustomerOrdersInformation_views_bp
from Back.orders.api.CustomerOrdersInformation_table import CustomerOrdersInformation_table_bp
from Back.Plan.api.Month_PlanFact_Gantt_api import init_app as planfact_init_app
from Back.Plan.api.Month_PlanFactSummary_api import init_app as planfact_summary_init_app
from Back.Home.api.Home_Production_api import init_app as home_production_init_app
app = Flask(__name__)
CORS(app)  # Разрешаем кросс-доменные запросы (CORS) от фронтенда

# Регистрация маршрутов
app.register_blueprint(CustomerOrdersInformation_views_bp)
app.register_blueprint(CustomerOrdersInformation_table_bp)
planfact_init_app(app)
planfact_summary_init_app(app)
home_production_init_app(app)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
