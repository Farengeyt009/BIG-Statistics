import pyodbc
from config import DB_CONFIG

def get_connection():
    try:
        # Проверяем, что все необходимые параметры заполнены
        if not DB_CONFIG['SERVER'] or DB_CONFIG['SERVER'] == 'your_database_name':
            raise ValueError("Не настроены параметры подключения к БД. Проверьте файл .env")
        
        # Строим строку подключения в зависимости от типа аутентификации
        if 'Trusted_Connection' in DB_CONFIG:
            # Windows Authentication
            conn_str = (
                f"DRIVER={DB_CONFIG['DRIVER']};"
                f"SERVER={DB_CONFIG['SERVER']}:{DB_CONFIG['PORT']};"
                f"DATABASE={DB_CONFIG['DATABASE']};"
                f"Trusted_Connection={DB_CONFIG['Trusted_Connection']};"
                f"Encrypt={DB_CONFIG['Encrypt']};"
                f"TrustServerCertificate={DB_CONFIG['TrustServerCertificate']};"
                f"Connection Timeout={DB_CONFIG['Connection Timeout']};"
            )
            print(f"Подключение к БД (Windows Auth): {DB_CONFIG['SERVER']}:{DB_CONFIG['PORT']}")
        else:
            # SQL Server Authentication
            conn_str = (
                f"DRIVER={DB_CONFIG['DRIVER']};"
                f"SERVER={DB_CONFIG['SERVER']}:{DB_CONFIG['PORT']};"
                f"DATABASE={DB_CONFIG['DATABASE']};"
                f"UID={DB_CONFIG['UID']};"
                f"PWD={DB_CONFIG['PWD']};"
                f"Encrypt={DB_CONFIG['Encrypt']};"
                f"TrustServerCertificate={DB_CONFIG['TrustServerCertificate']};"
                f"Connection Timeout={DB_CONFIG['Connection Timeout']};"
            )
            print(f"Подключение к БД (SQL Auth): {DB_CONFIG['SERVER']}:{DB_CONFIG['PORT']}")
        
        connection = pyodbc.connect(conn_str)
        print("Подключение к БД успешно установлено!")
        return connection
        
    except pyodbc.Error as e:
        error_msg = f"Ошибка подключения к базе данных: {e}"
        print(error_msg)
        raise RuntimeError(error_msg)
    except Exception as e:
        error_msg = f"Неожиданная ошибка: {e}"
        print(error_msg)
        raise RuntimeError(error_msg)
