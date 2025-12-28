"""
Service для получения аналитики по версии Sale Plan
"""
from typing import Dict, Any, List
from ....database.db_connector import get_connection


def get_version_analytics(version_id: int) -> Dict[str, Any]:
    """
    Получить краткую аналитику по версии Sale Plan
    - Общая сумма QTY
    - Распределение по Market
    - Распределение по LargeGroup
    """
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            
            # 1. Общая сумма QTY
            cur.execute("""
                SELECT ISNULL(SUM(QTY), 0) AS TotalQty
                FROM Orders.vw_SalesPlan_Details
                WHERE VersionID = ?
            """, (version_id,))
            
            total_qty = cur.fetchone()[0]
            
            # 2. Распределение по Market
            cur.execute("""
                SELECT 
                    Market,
                    SUM(QTY) AS QTY
                FROM Orders.vw_SalesPlan_Details
                WHERE VersionID = ?
                GROUP BY Market
                ORDER BY SUM(QTY) DESC
            """, (version_id,))
            
            market_rows = cur.fetchall()
            by_market = [
                {'Market': row[0], 'QTY': float(row[1])}
                for row in market_rows
            ]
            
            # 3. Распределение по LargeGroup
            cur.execute("""
                SELECT 
                    LargeGroup,
                    SUM(QTY) AS QTY
                FROM Orders.vw_SalesPlan_Details
                WHERE VersionID = ?
                GROUP BY LargeGroup
                ORDER BY SUM(QTY) DESC
            """, (version_id,))
            
            largegroup_rows = cur.fetchall()
            by_largegroup = [
                {'LargeGroup': row[0], 'QTY': float(row[1])}
                for row in largegroup_rows
            ]
            
            return {
                'success': True,
                'version_id': version_id,
                'total_qty': float(total_qty),
                'by_market': by_market,
                'by_largegroup': by_largegroup,
            }
            
    except Exception as e:
        raise Exception(f"Ошибка при получении аналитики: {str(e)}")


def get_version_export_data(version_id: int) -> List[Dict[str, Any]]:
    """
    Получить полные данные версии для экспорта в Excel
    Исключает ID поля (DetailID, VersionID)
    """
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            
            cur.execute("""
                SELECT 
                    YearNum,
                    MonthNum,
                    Market,
                    Article_number,
                    Name,
                    QTY,
                    LargeGroup
                FROM Orders.vw_SalesPlan_Details
                WHERE VersionID = ?
                ORDER BY YearNum, MonthNum, Market, Article_number
            """, (version_id,))
            
            columns = [col[0] for col in cur.description]
            rows = cur.fetchall()
            
            return [dict(zip(columns, row)) for row in rows]
            
    except Exception as e:
        raise Exception(f"Ошибка при получении данных для экспорта: {str(e)}")

