"""
Service для получения данных Sale Plan по году
"""
from typing import Dict, Any, List
from ....database.db_connector import get_connection


def get_active_version_data(year: int) -> Dict[str, Any]:
    """
    Получить данные активной версии Sale Plan для указанного года
    """
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            
            # 1. Находим активную версию для этого года
            cur.execute("""
                SELECT VersionID, UploadedAt, UploadedBy, TotalRecords, FileName, Comment
                FROM Orders.SalesPlan_Versions
                WHERE MinYear = ? AND IsActive = 1
            """, (year,))
            
            version_row = cur.fetchone()
            
            if not version_row:
                return {
                    'success': False,
                    'error': f'Нет активной версии для {year} года',
                    'year': year,
                }
            
            version_cols = [col[0] for col in cur.description]
            version_info = dict(zip(version_cols, version_row))
            version_id = version_info['VersionID']
            
            # 2. Получаем агрегированные данные из vw_SalesPlan_Details
            cur.execute("""
                SELECT 
                    YearNum,
                    MonthNum,
                    Market,
                    LargeGroup,
                    SUM(QTY) AS QTY
                FROM Orders.vw_SalesPlan_Details
                WHERE VersionID = ?
                GROUP BY YearNum, MonthNum, Market, LargeGroup
                ORDER BY YearNum, MonthNum, Market, LargeGroup
            """, (version_id,))
            
            data_cols = [col[0] for col in cur.description]
            data_rows = cur.fetchall()
            
            # Преобразуем Decimal в float для QTY
            details = []
            for row in data_rows:
                row_dict = dict(zip(data_cols, row))
                if 'QTY' in row_dict and row_dict['QTY'] is not None:
                    row_dict['QTY'] = float(row_dict['QTY'])
                details.append(row_dict)
            
            return {
                'success': True,
                'year': year,
                'version': version_info,
                'data': details,
                'total_records': len(details),
            }
            
    except Exception as e:
        raise Exception(f"Ошибка при получении данных: {str(e)}")

