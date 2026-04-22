"""
Сервис-слой: справочник отделов и привязка пользователей к отделам
"""

from typing import Any, Dict, List, Optional
import threading

from ...database.db_connector import get_connection

_schema_ensured = False
_schema_lock = threading.Lock()


def ensure_departments_schema() -> None:
    """
    Создает структуру departments и связь с Users.Users при отсутствии.
    Безопасно вызывать многократно.
    """
    global _schema_ensured
    if _schema_ensured:
        return

    with _schema_lock:
        if _schema_ensured:
            return

    with get_connection() as conn:
        cursor = conn.cursor()

        cursor.execute(
            """
            IF OBJECT_ID('Users.Departments', 'U') IS NULL
            BEGIN
                CREATE TABLE Users.Departments (
                    DepartmentID INT IDENTITY(1,1) PRIMARY KEY,
                    Name NVARCHAR(200) NOT NULL,
                    Code NVARCHAR(50) NULL,
                    IsActive BIT NOT NULL CONSTRAINT DF_Departments_IsActive DEFAULT (1),
                    SortOrder INT NOT NULL CONSTRAINT DF_Departments_SortOrder DEFAULT (0),
                    CreatedAt DATETIME NOT NULL CONSTRAINT DF_Departments_CreatedAt DEFAULT (GETDATE()),
                    UpdatedAt DATETIME NULL
                );
            END
            """
        )

        cursor.execute(
            """
            IF COL_LENGTH('Users.Users', 'department_id') IS NULL
            BEGIN
                ALTER TABLE Users.Users
                ADD department_id INT NULL;
            END
            """
        )

        cursor.execute(
            """
            IF NOT EXISTS (
                SELECT 1
                FROM sys.foreign_keys
                WHERE name = 'FK_Users_Departments'
                  AND parent_object_id = OBJECT_ID('Users.Users')
            )
            BEGIN
                ALTER TABLE Users.Users
                ADD CONSTRAINT FK_Users_Departments
                FOREIGN KEY (department_id) REFERENCES Users.Departments(DepartmentID);
            END
            """
        )

        cursor.execute(
            """
            IF NOT EXISTS (
                SELECT 1
                FROM sys.indexes
                WHERE name = 'IX_Users_Users_department_id'
                  AND object_id = OBJECT_ID('Users.Users')
            )
            BEGIN
                CREATE INDEX IX_Users_Users_department_id
                ON Users.Users(department_id);
            END
            """
        )

        cursor.execute(
            """
            IF NOT EXISTS (
                SELECT 1
                FROM sys.indexes
                WHERE name = 'UQ_Departments_Name'
                  AND object_id = OBJECT_ID('Users.Departments')
            )
            BEGIN
                CREATE UNIQUE INDEX UQ_Departments_Name
                ON Users.Departments(Name);
            END
            """
        )

        cursor.execute(
            """
            IF NOT EXISTS (
                SELECT 1
                FROM sys.indexes
                WHERE name = 'UQ_Departments_Code'
                  AND object_id = OBJECT_ID('Users.Departments')
            )
            BEGIN
                CREATE UNIQUE INDEX UQ_Departments_Code
                ON Users.Departments(Code)
                WHERE Code IS NOT NULL;
            END
            """
        )

        conn.commit()
        _schema_ensured = True


def get_departments(active_only: bool = True) -> List[Dict[str, Any]]:
    ensure_departments_schema()
    with get_connection() as conn:
        cursor = conn.cursor()

        sql = """
            SELECT DepartmentID, Name, NameEn, NameZh, Code, IsActive, SortOrder, CreatedAt, UpdatedAt
            FROM Users.Departments
        """
        params: List[Any] = []
        if active_only:
            sql += " WHERE IsActive = 1"
        sql += " ORDER BY SortOrder, Name"

        cursor.execute(sql, params)

        result = []
        for row in cursor.fetchall():
            result.append(
                {
                    "id": row.DepartmentID,
                    "name": row.Name,
                    "name_en": row.NameEn,
                    "name_zh": row.NameZh,
                    "code": row.Code,
                    "is_active": bool(row.IsActive),
                    "sort_order": row.SortOrder,
                    "created_at": row.CreatedAt.isoformat() if row.CreatedAt else None,
                    "updated_at": row.UpdatedAt.isoformat() if row.UpdatedAt else None,
                }
            )
        return result


def get_department_by_id(department_id: int, active_only: bool = False) -> Optional[Dict[str, Any]]:
    ensure_departments_schema()
    with get_connection() as conn:
        cursor = conn.cursor()
        sql = """
            SELECT DepartmentID, Name, NameEn, NameZh, Code, IsActive, SortOrder
            FROM Users.Departments
            WHERE DepartmentID = ?
        """
        params: List[Any] = [department_id]
        if active_only:
            sql += " AND IsActive = 1"
        cursor.execute(sql, params)
        row = cursor.fetchone()
        if not row:
            return None
        return {
            "id": row.DepartmentID,
            "name": row.Name,
            "name_en": row.NameEn,
            "name_zh": row.NameZh,
            "code": row.Code,
            "is_active": bool(row.IsActive),
            "sort_order": row.SortOrder,
        }


def create_department(name: str, code: Optional[str] = None, sort_order: int = 0, is_active: bool = True) -> Dict[str, Any]:
    ensure_departments_schema()
    normalized_name = (name or "").strip()
    normalized_code = (code or "").strip() or None

    if not normalized_name:
        raise ValueError("Department name is required")

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO Users.Departments (Name, Code, IsActive, SortOrder, CreatedAt, UpdatedAt)
            VALUES (?, ?, ?, ?, GETDATE(), GETDATE())
            """,
            (normalized_name, normalized_code, is_active, sort_order),
        )
        cursor.execute("SELECT @@IDENTITY AS DepartmentID")
        row = cursor.fetchone()
        conn.commit()
        return get_department_by_id(int(row.DepartmentID))  # type: ignore[arg-type]


def update_department(
    department_id: int,
    name: Optional[str] = None,
    code: Optional[str] = None,
    is_active: Optional[bool] = None,
    sort_order: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    ensure_departments_schema()
    updates: List[str] = []
    params: List[Any] = []

    if name is not None:
        normalized_name = name.strip()
        if not normalized_name:
            raise ValueError("Department name cannot be empty")
        updates.append("Name = ?")
        params.append(normalized_name)

    if code is not None:
        updates.append("Code = ?")
        params.append(code.strip() or None)

    if is_active is not None:
        updates.append("IsActive = ?")
        params.append(is_active)

    if sort_order is not None:
        updates.append("SortOrder = ?")
        params.append(sort_order)

    if not updates:
        raise ValueError("No data to update")

    params.extend([department_id])
    sql = f"""
        UPDATE Users.Departments
        SET {", ".join(updates)}, UpdatedAt = GETDATE()
        WHERE DepartmentID = ?
    """

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        if cursor.rowcount == 0:
            return None
        conn.commit()
        return get_department_by_id(department_id)


def count_users_in_department(department_id: int) -> int:
    ensure_departments_schema()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT COUNT(*) AS user_count
            FROM Users.Users
            WHERE department_id = ?
            """,
            (department_id,),
        )
        row = cursor.fetchone()
        return int(row.user_count) if row else 0


def delete_department(department_id: int, hard_delete: bool = False) -> Dict[str, Any]:
    ensure_departments_schema()
    linked_users = count_users_in_department(department_id)

    if hard_delete and linked_users > 0:
        raise ValueError("Cannot hard-delete department with linked users")

    with get_connection() as conn:
        cursor = conn.cursor()

        if hard_delete:
            cursor.execute(
                """
                DELETE FROM Users.Departments
                WHERE DepartmentID = ?
                """,
                (department_id,),
            )
            deleted = cursor.rowcount > 0
            conn.commit()
            return {
                "deleted": deleted,
                "hard_delete": True,
                "linked_users": linked_users,
            }

        cursor.execute(
            """
            UPDATE Users.Departments
            SET IsActive = 0, UpdatedAt = GETDATE()
            WHERE DepartmentID = ?
            """,
            (department_id,),
        )
        updated = cursor.rowcount > 0
        conn.commit()
        return {
            "deleted": updated,
            "hard_delete": False,
            "linked_users": linked_users,
        }


def validate_active_department(department_id: int, cursor=None) -> Optional[Dict[str, Any]]:
    ensure_departments_schema()
    owns_connection = cursor is None
    conn = None
    try:
        if owns_connection:
            conn = get_connection()
            cursor = conn.cursor()

        cursor.execute(
            """
            SELECT DepartmentID, Name, IsActive
            FROM Users.Departments
            WHERE DepartmentID = ?
            """,
            (department_id,),
        )
        row = cursor.fetchone()
        if not row:
            return None
        if not bool(row.IsActive):
            return None
        return {"id": row.DepartmentID, "name": row.Name, "is_active": bool(row.IsActive)}
    finally:
        if owns_connection and conn:
            conn.close()


def get_users_without_department(limit: int = 200) -> List[Dict[str, Any]]:
    ensure_departments_schema()
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT TOP (?) UserID, Username, FullName, Email, IsAdmin, IsActive
            FROM Users.Users
            WHERE department_id IS NULL
            ORDER BY Username
            """,
            (limit,),
        )
        result = []
        for row in cursor.fetchall():
            result.append(
                {
                    "user_id": row.UserID,
                    "username": row.Username,
                    "full_name": row.FullName,
                    "email": row.Email,
                    "is_admin": bool(row.IsAdmin),
                    "is_active": bool(row.IsActive),
                }
            )
        return result


def assign_user_department(user_id: int, department_id: int) -> bool:
    ensure_departments_schema()
    with get_connection() as conn:
        cursor = conn.cursor()
        dep = validate_active_department(department_id, cursor=cursor)
        if not dep:
            raise ValueError("Department not found or inactive")

        cursor.execute(
            """
            UPDATE Users.Users
            SET department_id = ?
            WHERE UserID = ?
            """,
            (department_id, user_id),
        )
        updated = cursor.rowcount > 0
        conn.commit()
        return updated
