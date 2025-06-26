# Run_Server.py

from flask import Flask
from flask_cors import CORS

from routes.uncompleted_orders_views import uncompleted_orders_views_bp
from routes.uncompleted_orders_table import uncompleted_orders_table_bp

app = Flask(__name__)
CORS(app)  # Разрешаем кросс-доменные запросы (CORS) от фронтенда

# Регистрация маршрутов
app.register_blueprint(uncompleted_orders_views_bp)
app.register_blueprint(uncompleted_orders_table_bp)

if __name__ == '__main__':
    app.run(debug=True)
