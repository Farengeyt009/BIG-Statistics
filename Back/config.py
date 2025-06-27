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