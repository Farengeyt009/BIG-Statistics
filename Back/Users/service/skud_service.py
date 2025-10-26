"""
Service for SKUD integration
"""

from ...database.db_connector import get_connection


def check_empcode_in_skud(empcode: str):
    """
    Проверяет существует ли empcode в таблице Import_SKUD.empinfo
    
    Args:
        empcode: Код сотрудника
        
    Returns:
        {
            'exists': True/False,
            'empcode': '12345',
            'empname': 'Иван Петров',
            'isactive': True
        } или None если не найден
    """
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT 
                    empcode,
                    empname,
                    isactive,
                    deptname2,
                    deptname3
                FROM Import_SKUD.empinfo
                WHERE empcode = ?
            """, (empcode,))
            
            row = cursor.fetchone()
            
            if row:
                return {
                    'exists': True,
                    'empcode': str(row.empcode) if row.empcode else '',
                    'empname': str(row.empname) if row.empname else '',
                    'isactive': bool(row.isactive),
                    'department': str(row.deptname2 or row.deptname3 or '')
                }
            else:
                return {'exists': False}
                
    except Exception as e:
        print(f"Error checking empcode in SKUD: {str(e)}")
        return None


def get_employee_info(empcode: str):
    """
    Получает полную информацию о сотруднике из СКУД
    
    Args:
        empcode: Код сотрудника
        
    Returns:
        {
            'empcode': '12345',
            'empname': 'Иван Петров',
            'birthday': '1990-01-15',
            'age': 35,
            'entrydate': '2020-03-01',
            'emptype': 'штатный',
            'isactive': True,
            'deptname2': 'Производство',
            'deptname3': 'Цех сборки',
            'deptname4': 'Участок 1',
            'deptname5': None
        } или None
    """
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT 
                    empcode,
                    empname,
                    birthday,
                    age,
                    entrydate,
                    emptype,
                    isactive,
                    deptname2,
                    deptname3,
                    deptname4,
                    deptname5,
                    LastUpdated
                FROM Import_SKUD.empinfo
                WHERE empcode = ?
            """, (empcode,))
            
            row = cursor.fetchone()
            
            if row:
                return {
                    'empcode': str(row.empcode) if row.empcode else '',
                    'empname': str(row.empname) if row.empname else '',
                    'birthday': row.birthday.isoformat() if row.birthday else None,
                    'age': int(row.age) if row.age else 0,
                    'entrydate': row.entrydate.isoformat() if row.entrydate else None,
                    'emptype': str(row.emptype) if row.emptype else '',
                    'isactive': bool(row.isactive),
                    'deptname2': str(row.deptname2) if row.deptname2 else '',
                    'deptname3': str(row.deptname3) if row.deptname3 else '',
                    'deptname4': str(row.deptname4) if row.deptname4 else '',
                    'deptname5': str(row.deptname5) if row.deptname5 else ''
                }
            else:
                return None
                
    except Exception as e:
        print(f"Error getting employee info: {str(e)}")
        return None

