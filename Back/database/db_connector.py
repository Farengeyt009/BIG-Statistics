import pyodbc
from config import DB_CONFIG

def get_connection():
    try:
        conn_str = (
            f"DRIVER={DB_CONFIG['DRIVER']};"
            f"SERVER={DB_CONFIG['SERVER']};"
            f"DATABASE={DB_CONFIG['DATABASE']};"
            f"UID={DB_CONFIG['UID']};"
            f"PWD={DB_CONFIG['PWD']};"
            f"TrustServerCertificate={DB_CONFIG.get('TrustServerCertificate', 'no')};"
        )
        connection = pyodbc.connect(conn_str)
        return connection
    except Exception as e:
        raise RuntimeError(f"Ошибка подключения к базе данных: {e}")
