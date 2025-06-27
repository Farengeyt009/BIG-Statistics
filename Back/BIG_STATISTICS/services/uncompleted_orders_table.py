from datetime import datetime, date
from decimal import Decimal
from ..database.db_connector import get_connection
from cachetools import cached, TTLCache

def try_convert_value(value):
    if value is None:
        return None

    # Числа из Decimal → float
    if isinstance(value, Decimal):
        return float(value)

    # Уже дата/время → в ISO
    if isinstance(value, (datetime, date)):
        return value.strftime("%Y-%m-%d")

    # Строка → попытка преобразовать
    if isinstance(value, str):
        v = value.strip()

        # Число?
        try:
            return float(v.replace(",", ".").replace(" ", ""))
        except ValueError:
            pass

        # Дата в формате RFC — 'Thu, 15 May 2025 00:00:00 GMT'
        try:
            if v.endswith("GMT"):
                v = v.replace("GMT", "").strip()
                dt = datetime.strptime(v, "%a, %d %b %Y %H:%M:%S")
                return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

        return v

    return value


@cached(TTLCache(maxsize=1, ttl=60))
def get_all_uncompleted_orders_table():
    conn = get_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM dbo.Uncompleted_Orders"
    cursor.execute(query)
    columns = [column[0] for column in cursor.description]

    data = []
    for row in cursor.fetchall():
        row_dict = {
            col: try_convert_value(val)
            for col, val in zip(columns, row)
        }
        data.append(row_dict)

    cursor.close()
    conn.close()
    return data
