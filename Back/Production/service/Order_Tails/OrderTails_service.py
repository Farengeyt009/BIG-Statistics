from typing import List, Dict, Any


def _rows_to_dicts(cursor) -> List[Dict[str, Any]]:
    cols = [c[0] for c in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]


class OrderTailsService:
    def __init__(self, db_connection):
        self.conn = db_connection

    def get_order_tails(self) -> List[Dict[str, Any]]:
        sql = (
            "SELECT\n"
            "    t1.WorkShopName_CH,\n"
            "    t2.LargeGroup,\n"
            "    t2.GroupName,\n"
            "    t1.OrderNumber,\n"
            "    t1.NomenclatureNumber,\n"
            "    t1.Total_QTY,\n"
            "    t1.FactTotal_QTY,\n"
            "    MIN(t1.TailStartDate) AS TailStartDate,\n"
            "    CASE\n"
            "        WHEN COUNT(*) - COUNT(t1.TailResolvedDate) > 0 THEN NULL\n"
            "        ELSE MAX(t1.TailResolvedDate)\n"
            "    END AS TailResolvedDate,\n"
            "    SUM(t1.TailIntervalDays) AS TailDays,\n"
            "    CASE\n"
            "        WHEN COUNT(*) - COUNT(t1.TailResolvedDate) > 0 THEN 1\n"
            "        ELSE 0\n"
            "    END AS Active_Tail\n"
            "FROM Analytics.OrderTails AS t1\n"
            "LEFT JOIN Ref.Product_Guide AS t2\n"
            "    ON t1.NomenclatureNumber = t2.FactoryNumber\n"
            "GROUP BY\n"
            "    t1.WorkShopName_CH,\n"
            "    t2.LargeGroup,\n"
            "    t2.GroupName,\n"
            "    t1.OrderNumber,\n"
            "    t1.NomenclatureNumber,\n"
            "    t1.Total_QTY,\n"
            "    t1.FactTotal_QTY\n"
        )
        cur = self.conn.cursor()
        try:
            cur.execute(sql)
            return _rows_to_dicts(cur)
        finally:
            cur.close()


