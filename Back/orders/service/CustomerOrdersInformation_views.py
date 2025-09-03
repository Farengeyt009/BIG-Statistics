from database.db_connector import get_connection
from collections import defaultdict
import datetime
import decimal
def get_CustomerOrdersInformation_views():
    query_main = """
        SELECT
            ShipmentYear AS [year],
            ShipmentMonth AS [month],
            ISNULL(Prod_Group, 'No Group') AS Prod_Group,
            SUM(Uncompleted_QTY) AS Total_Uncompleted_QTY
        FROM dbo.Uncompleted_Orders
        GROUP BY
            ShipmentYear, ShipmentMonth, Prod_Group
        ORDER BY
            ShipmentYear, ShipmentMonth, Prod_Group;
    """

    query_overdue = """
        SELECT COUNT(*) FROM dbo.Uncompleted_Orders WHERE Delay IS NOT NULL;
    """

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(query_main)
    columns = [column[0] for column in cursor.description]
    rows = cursor.fetchall()

    data = []
    total_by_month = defaultdict(float)
    grand_total = 0.0

    for row in rows:
        record = dict(zip(columns, row))
        if isinstance(record["Total_Uncompleted_QTY"], decimal.Decimal):
            record["Total_Uncompleted_QTY"] = float(record["Total_Uncompleted_QTY"])
        data.append(record)

        ym_key = f"{record['year']}-{str(record['month']).zfill(2)}"
        total_by_month[ym_key] += record["Total_Uncompleted_QTY"]
        grand_total += record["Total_Uncompleted_QTY"]

    cursor.execute(query_overdue)
    total_overdue_orders = cursor.fetchone()[0]

    conn.close()

    return {
        "data": data,
        "total_by_month": dict(total_by_month),
        "grand_total": grand_total,
        "total_overdue_orders": total_overdue_orders
    }
