from dotenv import load_dotenv
import os

load_dotenv()  # Загружает переменные из .env

DB_CONFIG = {
    'DRIVER': '{ODBC Driver 18 for SQL Server}',
    'SERVER': os.getenv('DB_SERVER'),
    'DATABASE': os.getenv('DB_NAME'),
    'UID': os.getenv('DB_USER'),
    'PWD': os.getenv('DB_PASSWORD'),
    'TrustServerCertificate': 'yes'
}

WECHAT_CONFIG = {
    'APP_ID': os.getenv('WECHAT_APP_ID'),
    'APP_SECRET': os.getenv('WECHAT_APP_SECRET'),
    'REDIRECT_URI': os.getenv('WECHAT_REDIRECT_URI'),
    'QR_SESSION_TIMEOUT': int(os.getenv('WECHAT_QR_TIMEOUT', '300'))  # 5 минут по умолчанию
}