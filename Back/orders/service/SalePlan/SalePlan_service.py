"""
Service для работы с Sale Plan (получение данных, управление версиями)
"""
from typing import Dict, Any
from ....database.db_connector import get_connection


def set_active_version(version_id: int) -> Dict[str, Any]:
    """
    Устанавливает версию как активную
    Автоматически снимает флаг IsActive с других версий этого же года
    """
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            
            # Вызываем процедуру
            cur.execute("EXEC Orders.sp_SalePlan_SetActive @VersionID = ?", (version_id,))
            conn.commit()
            
            return {
                'success': True,
                'version_id': version_id,
            }
            
    except Exception as e:
        raise Exception(f"Ошибка при установке активной версии: {str(e)}")


def delete_version(version_id: int) -> Dict[str, Any]:
    """
    Удаляет версию Sale Plan
    Каскадно удаляются все детали (Orders.SalesPlan_Details) благодаря FK
    """
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            
            # Проверяем существование
            cur.execute("SELECT 1 FROM Orders.SalesPlan_Versions WHERE VersionID = ?", (version_id,))
            if not cur.fetchone():
                raise ValueError(f"Версия {version_id} не найдена")
            
            # Удаляем (детали удалятся автоматически благодаря ON DELETE CASCADE)
            cur.execute("DELETE FROM Orders.SalesPlan_Versions WHERE VersionID = ?", (version_id,))
            conn.commit()
            
            return {
                'success': True,
                'version_id': version_id,
            }
            
    except Exception as e:
        raise Exception(f"Ошибка при удалении версии: {str(e)}")

