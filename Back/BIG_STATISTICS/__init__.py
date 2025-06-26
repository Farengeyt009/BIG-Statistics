from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
import os

# Загружаем переменные окружения ПЕРЕД созданием приложения
load_dotenv()

def create_app():
    app = Flask(__name__)
    
    # Настройка CORS
    CORS(app)
    
    # Регистрация blueprints
    from routes.uncompleted_orders_views import uncompleted_orders_views_bp
    from routes.uncompleted_orders_table import uncompleted_orders_table_bp
    
    app.register_blueprint(uncompleted_orders_views_bp)
    app.register_blueprint(uncompleted_orders_table_bp)
    
    return app
