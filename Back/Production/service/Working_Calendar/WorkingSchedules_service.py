import pyodbc
import json
from Back.config import DB_CONFIG
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone


# ==== публичные ошибки сервиса ====
class ConflictError(Exception): ...


class ValidationError(Exception): ...


class NotFoundError(Exception): ...


class DbError(Exception): ...


class WorkingCalendarService:
    def __init__(self):
        self.connection_string = (
            f"DRIVER={DB_CONFIG['DRIVER']};"
            f"SERVER={DB_CONFIG['SERVER']};"
            f"DATABASE={DB_CONFIG['DATABASE']};"
            f"UID={DB_CONFIG['UID']};"
            f"PWD={DB_CONFIG['PWD']};"
            f"TrustServerCertificate={DB_CONFIG['TrustServerCertificate']};"
            f"MARS_Connection=Yes;"
        )

    def get_work_centers(self) -> List[Dict[str, Any]]:
        """
        Получает список всех рабочих центров из базы данных
        """
        try:
            with pyodbc.connect(self.connection_string) as connection:
                cursor = connection.cursor()

                query = """
                SELECT DISTINCT WorkShop_CustomWS, WorkShopName_ZH, WorkShopName_EN 
                FROM Ref.WorkShop_CustomWS 
                ORDER BY WorkShop_CustomWS
                """

                cursor.execute(query)
                rows = cursor.fetchall()

                work_centers = []
                for row in rows:
                    work_centers.append({
                        'id': row[0],  # WorkShop_CustomWS как ID
                        'nameZH': row[1] if row[1] else row[0],  # WorkShopName_ZH или fallback
                        'nameEN': row[2] if row[2] else row[0]  # WorkShopName_EN или fallback
                    })

                return work_centers

        except Exception as e:
            print(f"Error in get_work_centers: {str(e)}")
            return []

    def get_work_center_by_id(self, work_center_id: str) -> Dict[str, Any]:
        """
        Получает конкретный рабочий центр по ID
        """
        try:
            with pyodbc.connect(self.connection_string) as connection:
                cursor = connection.cursor()

                query = """
                SELECT DISTINCT WorkShop_CustomWS, WorkShopName_ZH, WorkShopName_EN 
                FROM Ref.WorkShop_CustomWS 
                WHERE WorkShop_CustomWS = ?
                """

                cursor.execute(query, (work_center_id,))
                row = cursor.fetchone()

                if row:
                    return {
                        'id': row[0],
                        'nameZH': row[1] if row[1] else row[0],
                        'nameEN': row[2] if row[2] else row[0]
                    }
                else:
                    return {}

        except Exception as e:
            print(f"Error in get_work_center_by_id: {str(e)}")
            return {}

    def get_work_centers_count(self) -> int:
        """
        Получает количество рабочих центров
        """
        try:
            with pyodbc.connect(self.connection_string) as connection:
                cursor = connection.cursor()

                query = """
                SELECT COUNT(DISTINCT WorkShop_CustomWS) 
                FROM Ref.WorkShop_CustomWS
                """

                cursor.execute(query)
                count = cursor.fetchone()[0]

                return count

        except Exception as e:
            print(f"Error in get_work_centers_count: {str(e)}")
            return 0

    def get_work_schedule_types(self) -> List[Dict[str, Any]]:
        """
        Получает типы рабочих графиков (table2)
        """
        try:
            with pyodbc.connect(self.connection_string) as connection:
                cursor = connection.cursor()

                query = """
                SELECT TypeID, TypeName_EN, TypeName_ZH 
                FROM TimeLoss.WorkScheduleTypes 
                ORDER BY TypeID
                """

                cursor.execute(query)
                rows = cursor.fetchall()

                work_schedule_types = []
                for row in rows:
                    work_schedule_types.append({
                        'id': row[0],  # TypeID как ID
                        'nameEN': row[1] if row[1] else f"Type {row[0]}",  # TypeName_EN или fallback
                        'nameZH': row[2] if row[2] else f"类型 {row[0]}"  # TypeName_ZH или fallback
                    })

                return work_schedule_types

        except Exception as e:
            print(f"Error in get_work_schedule_types: {str(e)}")
            return []

    def get_work_schedules(self, workshop_id: str = None, include_deleted: bool = False) -> List[Dict[str, Any]]:
        """
        Получает список графиков работ с линиями
        """
        try:
            with pyodbc.connect(self.connection_string) as connection:
                cursor = connection.cursor()

                if workshop_id:
                    header_query = """
                    SELECT 
                        ScheduleID,
                        ScheduleCode,       -- computed
                        WorkShopID,
                        ScheduleName,
                        IsFavorite,
                        IsDeleted,
                        CreatedAt,
                        UpdatedAt,
                        CreatedBy,
                        UpdatedBy
                    FROM TimeLoss.Working_Schedule
                    WHERE WorkShopID = ? AND (? = 1 OR IsDeleted = 0)
                    ORDER BY IsFavorite DESC, ScheduleID DESC
                    """
                    cursor.execute(header_query, (workshop_id, 1 if include_deleted else 0))
                else:
                    header_query = """
                    SELECT 
                        ScheduleID,
                        ScheduleCode,
                        WorkShopID,
                        ScheduleName,
                        IsFavorite,
                        IsDeleted,
                        CreatedAt,
                        UpdatedAt,
                        CreatedBy,
                        UpdatedBy
                    FROM TimeLoss.Working_Schedule
                    WHERE ? = 1 OR IsDeleted = 0
                    ORDER BY IsFavorite DESC, ScheduleID DESC
                    """
                    cursor.execute(header_query, (1 if include_deleted else 0,))

                header_rows = cursor.fetchall()
                schedules = []

                for h in header_rows:
                    schedule_id = h[0]

                    lines_query = """
                    SELECT TypeID, StartTime, EndTime, CrossesMidnight, SpanMinutes, StartMin
                    FROM TimeLoss.Working_ScheduleType
                    WHERE ScheduleID = ?
                    ORDER BY StartMin
                    """
                    cursor.execute(lines_query, (schedule_id,))
                    rows = cursor.fetchall()
                    lines = [{
                        'typeId': r[0],
                        'start': self._time_to_str(r[1]),
                        'end': self._time_to_str(r[2]),
                        'crossesMidnight': bool(r[3]),
                        'spanMinutes': int(r[4])
                    } for r in rows]

                    schedules.append({
                        'scheduleId': h[0],
                        'scheduleCode': h[1],
                        'workshopId': h[2],
                        'workShopId': h[2],  # алиас
                        'name': h[3],
                        'scheduleName': h[3],  # алиас
                        'isFavorite': bool(h[4]),
                        'isDeleted': bool(h[5]),
                        'createdAt': self._to_iso_utc(h[6]),
                        'updatedAt': self._to_iso_utc(h[7]),
                        'createdBy': h[8],
                        'updatedBy': h[9],
                        'lines': lines
                    })

                return schedules
        except Exception as e:
            print(f"Error in get_work_schedules: {str(e)}")
            return []

    def get_work_schedule_by_id(self, schedule_id: int) -> Dict[str, Any]:
        """
        Получает график работ по ID с деталями
        """
        try:
            with pyodbc.connect(self.connection_string) as connection:
                cursor = connection.cursor()

                header_query = """
                SELECT 
                    ScheduleID,
                    ScheduleCode,
                    WorkShopID,
                    ScheduleName,
                    IsFavorite,
                    IsDeleted,
                    CreatedAt,
                    UpdatedAt,
                    CreatedBy,
                    UpdatedBy
                FROM TimeLoss.Working_Schedule
                WHERE ScheduleID = ?
                """
                cursor.execute(header_query, (schedule_id,))
                h = cursor.fetchone()
                if not h:
                    return {}

                lines_query = """
                SELECT TypeID, StartTime, EndTime, CrossesMidnight, SpanMinutes, StartMin
                FROM TimeLoss.Working_ScheduleType
                WHERE ScheduleID = ?
                ORDER BY StartMin
                """
                cursor.execute(lines_query, (schedule_id,))
                rows = cursor.fetchall()

                # наш современный формат
                lines = [{
                    'typeId': r[0],
                    'start': self._time_to_str(r[1]),
                    'end': self._time_to_str(r[2]),
                    'crossesMidnight': bool(r[3]),
                    'spanMinutes': int(r[4])
                } for r in rows]

                # старый формат для формы
                records = [{
                    'recordType': r[0],  # 'WORKSHIFT' / 'BREAKS'
                    'startTime': self._time_to_str(r[1]),
                    'endTime': self._time_to_str(r[2])
                } for r in rows]

                return {
                    'scheduleId': h[0],
                    'scheduleCode': h[1],
                    'workshopId': h[2],  # новый
                    'workShopId': h[2],  # алиас для совместимости
                    'name': h[3],  # новый
                    'scheduleName': h[3],  # алиас для фронта
                    'isFavorite': bool(h[4]),
                    'isDeleted': bool(h[5]),
                    'createdAt': self._to_iso_utc(h[6]),
                    'updatedAt': self._to_iso_utc(h[7]),
                    'createdBy': h[8],
                    'updatedBy': h[9],
                    'lines': lines,  # новый формат
                    'records': records  # старый формат (для модалки)
                }
        except Exception as e:
            print(f"Error in get_work_schedule_by_id: {str(e)}")
            return {}

    def create_work_schedule(self, schedule_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Создает новый график работ
        """
        try:
            with pyodbc.connect(self.connection_string) as connection:
                cursor = connection.cursor()

                # Вызываем процедуру создания
                cursor.execute("""
                    EXEC TimeLoss.sp_WorkingSchedule_Create
                        @WorkShopID = ?,
                        @ScheduleName = ?,
                        @IsFavorite = ?,
                        @LinesJson = ?,
                        @Actor = ?
                """, (
                    schedule_data['workshopId'],
                    schedule_data['name'],
                    int(bool(schedule_data['isFavorite'])),
                    json.dumps(schedule_data['lines'], ensure_ascii=False),
                    schedule_data.get('actor', 'api')
                ))

                result = cursor.fetchone()
                if result:
                    return {
                        'scheduleId': int(result[0]),
                        'scheduleCode': result[1],
                        'updatedAt': self._to_iso_utc(result[2])
                    }

                raise DbError("Stored procedure returned no rows")

        except pyodbc.Error as e:
            self._raise_for_db_error(e)
        except Exception as e:
            print(f"Error in create_work_schedule: {str(e)}")
            raise

    def update_work_schedule(self, schedule_id: int, schedule_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Логика:
        - Если изменился состав строк (добавили/удалили/тип/время) → Replace (НОВЫЙ ScheduleID)
        - Если переименование и forceNewOnRename=True (по умолчанию) → Replace (НОВЫЙ ScheduleID)
        - Если изменились только имя/⭐ и forceNewOnRename=False → UpdateHeader (тот же ScheduleID)
        - Если вообще ничего не поменялось → no-op (тот же ScheduleID/updatedAt)
        """
        try:
            # 0) Текущая версия + оптимистичная блокировка
            current = self.get_work_schedule_by_id(schedule_id)
            if not current:
                raise NotFoundError("Schedule not found")
            if current["updatedAt"] != schedule_data["updatedAt"]:
                raise ConflictError("Schedule was changed by another user")

            # 1) Дельты
            lines_changed = (self._norm_lines(current["lines"]) != self._norm_lines(schedule_data["lines"]))
            name_changed = current["name"].strip() != str(schedule_data["name"]).strip()
            fav_changed = bool(current["isFavorite"]) != bool(schedule_data["isFavorite"])
            force_new_on_rename = bool(schedule_data.get("forceNewOnRename", True))  # ⬅ по умолчанию ВКЛ.

            # 2) Ничего не поменялось
            if not lines_changed and not name_changed and not fav_changed:
                return {
                    "scheduleId": current["scheduleId"],
                    "scheduleCode": current["scheduleCode"],
                    "updatedAt": current["updatedAt"]
                }

            # 3) Любые изменения строк ИЛИ переименование с опцией → новая версия (Replace)
            if lines_changed or (name_changed and force_new_on_rename):
                with pyodbc.connect(self.connection_string) as connection:
                    cursor = connection.cursor()

                    # Передаём updatedAt обратно в DATETIME2(0) UTC
                    upd = schedule_data['updatedAt']
                    dt2 = self._parse_iso_to_naive_utc(upd)

                    cursor.execute("""
                        EXEC TimeLoss.sp_WorkingSchedule_Replace
                            @OldScheduleID = ?,
                            @UpdatedAt = ?,
                            @WorkShopID = ?,
                            @ScheduleName = ?,
                            @IsFavorite = ?,
                            @LinesJson = ?,
                            @Actor = ?
                    """, (
                        schedule_id,
                        dt2,
                        schedule_data['workshopId'],
                        schedule_data['name'],
                        int(bool(schedule_data['isFavorite'])),
                        json.dumps(schedule_data['lines'], ensure_ascii=False),
                        schedule_data.get('actor', 'api')
                    ))

                    result = cursor.fetchone()
                    # На всякий случай дренируем все result sets
                    try:
                        while cursor.nextset():
                            pass
                    except pyodbc.Error:
                        pass
                    cursor.close()

                    if result:
                        new_schedule_id = int(result[0])
                        # ВАЖНО: никаких пересчётов здесь не делаем.
                        # Пересчёт выполняется там, где меняют назначения: WorkSchedules_ByDay_service.py
                        return {
                            'scheduleId': new_schedule_id,
                            'scheduleCode': result[1],
                            'updatedAt': self._to_iso_utc(result[2])
                        }

                    raise DbError("Stored procedure returned no rows")

            # 4) Изменились только мета-поля (имя/⭐), и НE хотим новый ID → апдейт шапки
            with pyodbc.connect(self.connection_string) as connection:
                cursor = connection.cursor()

                # Передаём updatedAt обратно в DATETIME2(0) UTC
                upd = schedule_data['updatedAt']
                dt2 = self._parse_iso_to_naive_utc(upd)

                cursor.execute("""
                    EXEC TimeLoss.sp_WorkingSchedule_UpdateHeader
                        @ScheduleID = ?,
                        @UpdatedAt = ?,
                        @ScheduleName = ?,
                        @IsFavorite = ?,
                        @Actor = ?
                """, (
                    schedule_id,
                    dt2,
                    schedule_data['name'],
                    int(bool(schedule_data['isFavorite'])),
                    schedule_data.get('actor', 'api')
                ))

                result = cursor.fetchone()
                if result:
                    return {
                        'scheduleId': int(result[0]),
                        'scheduleCode': result[1],
                        'updatedAt': self._to_iso_utc(result[2])
                    }

                raise DbError("Stored procedure returned no rows")

        except pyodbc.Error as e:
            self._raise_for_db_error(e)
        except Exception as e:
            print(f"Error in update_work_schedule: {str(e)}")
            raise

    def delete_work_schedule(self, schedule_id: int) -> bool:
        """
        Мягкое удаление графика работ
        """
        try:
            with pyodbc.connect(self.connection_string) as connection:
                cursor = connection.cursor()

                cursor.execute("""
                    EXEC TimeLoss.sp_WorkingSchedule_SoftDelete
                        @ScheduleID = ?,
                        @Actor = ?
                """, (schedule_id, 'api'))

                return True

        except pyodbc.Error as e:
            self._raise_for_db_error(e)
        except Exception as e:
            print(f"Error in delete_work_schedule: {str(e)}")
            raise

    def restore_work_schedule(self, schedule_id: int) -> bool:
        """
        Восстанавливает удаленный график работ
        """
        try:
            with pyodbc.connect(self.connection_string) as connection:
                cursor = connection.cursor()

                cursor.execute("""
                    EXEC TimeLoss.sp_WorkingSchedule_Restore
                        @ScheduleID = ?,
                        @Actor = ?
                """, (schedule_id, 'api'))

                return True

        except pyodbc.Error as e:
            self._raise_for_db_error(e)
        except Exception as e:
            print(f"Error in restore_work_schedule: {str(e)}")
            raise

    def clone_work_schedule(self, schedule_id: int, new_name: str = None) -> Dict[str, Any]:
        """
        Клонирует график работ
        """
        try:
            with pyodbc.connect(self.connection_string) as connection:
                cursor = connection.cursor()

                cursor.execute("""
                    EXEC TimeLoss.sp_WorkingSchedule_Clone
                        @SourceScheduleID = ?,
                        @NewName = ?,
                        @Actor = ?
                """, (schedule_id, new_name, 'api'))

                result = cursor.fetchone()
                if result:
                    return {
                        'scheduleId': int(result[0]),
                        'scheduleCode': result[1],
                        'updatedAt': self._to_iso_utc(result[2])
                    }

                raise DbError("Stored procedure returned no rows")

        except pyodbc.Error as e:
            self._raise_for_db_error(e)
        except Exception as e:
            print(f"Error in clone_work_schedule: {str(e)}")
            raise

    # ==== вспомогательные методы ====

    def _to_iso_utc(self, dt: Optional[datetime]) -> Optional[str]:
        """Конвертирует datetime в ISO UTC строку"""
        if dt is None:
            return None
        if dt.tzinfo is None:
            # считаем, что в БД UTC (мы писали SYSUTCDATETIME) → пометить Z
            return dt.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
        return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

    def _raise_for_db_error(self, e: pyodbc.Error):
        """Обрабатывает ошибки БД и поднимает соответствующие исключения"""
        raw = " | ".join(str(x) for x in e.args if x) or str(e)
        low = raw.lower()

        # вытащим номер ошибки SQL Server (2627, 2601, 547, 5001x и т.п.)
        import re
        num = None
        m = re.search(r'\((\d{4,5})\)', raw)
        if m:
            try:
                num = int(m.group(1))
            except:
                pass

        # 1) наш оптимистичный конфликт (только по явным маркерам)
        if 'conflict_updated_at' in low or 'conflict: schedule was changed' in low:
            raise ConflictError('Schedule was changed by another user')

        # 2) нарушения уникальности → валидация
        if num in (2627, 2601) or 'duplicate key' in low or 'unique constraint' in low or 'unique index' in low:
            raise ValidationError(raw)

        # 3) FK/CHECK и прочие "conflicted with ..." → валидация
        if num == 547 or 'foreign key constraint' in low or 'check constraint' in low or 'conflicted with' in low:
            raise ValidationError(raw)

        # 4) наши бизнес-валидации 50010..50099
        m2 = re.search(r'\((5\d{4})\)', raw)
        if m2:
            raise ValidationError(raw)

        # 5) наши русские валидации
        if ("перекры" in low or "пересека" in low or
                "длительн" in low or "некоррект" in low or
                ("неизвестн" in low and "type" in low) or
                "через полноч" in low):
            raise ValidationError(raw)

        # 6) not found
        if "not found" in low or "не найден" in low:
            raise NotFoundError(raw)

        # 7) остальное – как общая DB-ошибка
        raise DbError(raw)

    def _parse_iso_to_naive_utc(self, s: str) -> datetime:
        """Устойчивый парсинг ISO-даты в naive UTC datetime"""
        try:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
            return dt if dt.tzinfo is None else dt.astimezone(timezone.utc).replace(tzinfo=None)
        except Exception:
            # Fallback для старых версий Python
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
            return dt if dt.tzinfo is None else dt.astimezone(timezone.utc).replace(tzinfo=None)

    def _time_to_str(self, t):
        """Конвертирует время в строку HH:MM"""
        from datetime import time
        if isinstance(t, time):
            return t.strftime("%H:%M")
        if isinstance(t, str):
            return t[:5]
        return str(t)

    def _norm_lines(self, lines):
        """Сравнение МУЛЬТИМНОЖЕСТВА строк без учёта порядка и регистра TypeID"""

        def hhmm(v):
            s = self._time_to_str(v)
            return s[:5]

        return sorted([
            (str(l["typeId"]).upper().strip(), hhmm(l["start"]), hhmm(l["end"]))
            for l in lines
        ])
