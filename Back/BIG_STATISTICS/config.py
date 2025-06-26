from dotenv import load_dotenv
import os

load_dotenv()  # Загружает переменные из .env

# Определяем тип аутентификации
USE_WINDOWS_AUTH = os.getenv('USE_WINDOWS_AUTH', 'false').lower() == 'true'

if USE_WINDOWS_AUTH:
    # Windows Authentication
    DB_CONFIG = {
        'DRIVER': '{ODBC Driver 18 for SQL Server}',
        'SERVER': os.getenv('DB_HOST', 'localhost'),
        'PORT': os.getenv('DB_PORT', '1433'),
        'DATABASE': os.getenv('DB_NAME', 'your_database_name'),
        'Trusted_Connection': 'yes',
        'Encrypt': 'no',
        'TrustServerCertificate': 'yes',
        'Connection Timeout': '30'
    }
else:
    # SQL Server Authentication
    DB_CONFIG = {
        'DRIVER': '{ODBC Driver 18 for SQL Server}',
        'SERVER': os.getenv('DB_HOST', 'localhost'),
        'PORT': os.getenv('DB_PORT', '1433'),
        'DATABASE': os.getenv('DB_NAME', 'your_database_name'),
        'UID': os.getenv('DB_USER', 'your_username'),
        'PWD': os.getenv('DB_PASSWORD', 'your_password'),
        'Encrypt': 'no',
        'TrustServerCertificate': 'yes',
        'Connection Timeout': '30'
    }