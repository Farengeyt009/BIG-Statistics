from datetime import date
from typing import Any, Dict, List, Optional, Tuple

from ....database.db_connector import get_connection


def _recalc_for_date(conn, only_date):
    """Пересчитывает цепочку кэшей для указанной даты: WorkingSpans_Day → OrderSlots_Day → Fact_Takt"""
    cur = conn.cursor()
    cur.execute("EXEC Production_TV.sp_Refresh_Cache_WorkingSpans_Day @date = ?", (only_date,))
    cur.execute("EXEC Production_TV.sp_Refresh_Cache_OrderSlots_Day   @date = ?", (only_date,))
    cur.execute("EXEC Production_TV.sp_Refresh_Cache_Fact_Takt        @date = ?", (only_date,))
    conn.commit()


def _validate_people(people: Optional[int]) -> Optional[int]:
    if people is None:
        return None
    if isinstance(people, bool):
        # Защита от true/false, приводимых к 1/0
        raise ValueError("People must be integer or null, got boolean")
    try:
        people_int = int(people)
    except Exception:
        raise ValueError("People must be integer or null")
    if people_int < 0:
        # Отдадим явную ошибку до похода в БД с CHECK-констрейнтом
        raise ValueError("People must be >= 0 or null")
    return people_int


def _parse_date(date_string: str) -> date:
    try:
        return date.fromisoformat(date_string)
    except ValueError:
        raise ValueError("Invalid date format. Expected YYYY-MM-DD")


def get_work_schedules_by_day(
    date_string: str,
    work_shop_id: Optional[str] = None,
    work_center_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Возвращает активные (DeleteMark=0) строки смен на конкретную дату.
    Опционально можно отфильтровать по цеху и/или РЦ.
    """
    only_date = _parse_date(date_string)

    base_sql = (
        "SELECT LineID, OnlyDate, WorkShopID, WorkCenterID, ScheduleID, People "
        "FROM TimeLoss.WorkSchedules_ByDay WITH (NOLOCK) "
        "WHERE DeleteMark = 0 AND OnlyDate = ?"
    )
    params: List[Any] = [only_date]

    if work_shop_id:
        base_sql += " AND WorkShopID = ?"
        params.append(work_shop_id)
    if work_center_id:
        base_sql += " AND WorkCenterID = ?"
        params.append(work_center_id)

    base_sql += " ORDER BY WorkShopID, WorkCenterID, LineID"

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(base_sql, params)
        cols = [c[0] for c in cur.description]
        raw_rows = [dict(zip(cols, row)) for row in cur.fetchall()]

        # Нормализуем имена полей под фронт (camelCase)
        normalized: List[Dict[str, Any]] = []
        for r in raw_rows:
            normalized.append(
                {
                    "lineId": str(r.get("LineID")),
                    "onlyDate": str(r.get("OnlyDate")),
                    "workShopId": r.get("WorkShopID"),
                    "workCenterId": r.get("WorkCenterID"),
                    "scheduleId": str(r.get("ScheduleID")),
                    "people": r.get("People"),
                }
            )
        return normalized


def bulk_replace_work_schedules_by_day(
    date_string: str,
    items: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Заменяет набор смен по каждой связке (OnlyDate, WorkShopID, WorkCenterID).

    items = [
        {
            "workShopId": str,
            "workCenterId": str,
            "lines": [ { "scheduleId": str, "people": Optional[int] }, ... ]
        },
        ...
    ]

    Транзакция выполняется ОТДЕЛЬНО для каждой связки (по одному item),
    чтобы сбой по одной связке не откатывал остальные.
    Возвращает суммарную статистику и созданные LineID по связкам.
    """
    only_date = _parse_date(date_string)

    created_total = 0
    result_items: List[Dict[str, Any]] = []
    all_created_rows: List[Dict[str, Any]] = []

    with get_connection() as conn:
        # Явный контроль транзакций
        conn.autocommit = False

        for item in items:
            work_shop_id = (item or {}).get("workShopId")
            work_center_id = (item or {}).get("workCenterId")
            lines = (item or {}).get("lines") or []

            if not work_shop_id or not work_center_id:
                raise ValueError("workShopId and workCenterId are required for each item")

            cur = conn.cursor()
            try:
                cur.execute("SET XACT_ABORT ON;")

                # 1) Помечаем старые как удалённые
                cur.execute(
                    """
                    UPDATE TimeLoss.WorkSchedules_ByDay
                    SET DeleteMark = 1
                    WHERE OnlyDate = CONVERT(date, ?) AND WorkShopID = ? AND WorkCenterID = ? AND DeleteMark = 0
                    """,
                    (only_date, work_shop_id, work_center_id),
                )

                # 2) Создаём темповую таблицу результата для ЭТОГО item
                cur.execute("""
                    IF OBJECT_ID('tempdb..#out') IS NOT NULL DROP TABLE #out;
                    CREATE TABLE #out(
                      LineID uniqueidentifier,
                      OnlyDate date,
                      WorkShopID nvarchar(256),
                      WorkCenterID nvarchar(256),
                      ScheduleID nvarchar(256),  -- типы как в целевой таблице
                      People smallint            -- тип как в целевой таблице
                    );
                """)

                created_ids: List[str] = []
                created_rows: List[Dict[str, Any]] = []

                # 3) Вставляем строки, складывая OUTPUT в #out
                for line in lines:
                    schedule_id = (line or {}).get("scheduleId")
                    if not schedule_id:
                        raise ValueError("scheduleId is required for each line")
                    people = _validate_people((line or {}).get("people"))

                    cur.execute(
                        """
                        INSERT INTO TimeLoss.WorkSchedules_ByDay
                          (OnlyDate, WorkShopID, WorkCenterID, ScheduleID, People)
                        OUTPUT inserted.LineID, inserted.OnlyDate, inserted.WorkShopID,
                               inserted.WorkCenterID, inserted.ScheduleID, inserted.People
                        INTO #out(LineID, OnlyDate, WorkShopID, WorkCenterID, ScheduleID, People)
                        VALUES (CONVERT(date, ?), ?, ?, ?, ?);
                        """,
                        (only_date, work_shop_id, work_center_id, str(schedule_id), people),
                    )

                # 4) Забираем все вставленные строки одним SELECT
                cur.execute("SELECT LineID, OnlyDate, WorkShopID, WorkCenterID, ScheduleID, People FROM #out;")
                for line_id, only_date_out, ws_out, wc_out, sched_out, people_out in cur.fetchall():
                    created_ids.append(str(line_id))
                    created_rows.append({
                        "lineId": str(line_id),
                        "onlyDate": str(only_date_out),
                        "workShopId": ws_out,
                        "workCenterId": wc_out,
                        "scheduleId": str(sched_out),
                        "people": people_out,
                    })
                    created_total += 1

                # (опционально подчистить)
                cur.execute("DROP TABLE #out;")

                conn.commit()
                result_items.append({
                    "workShopId": work_shop_id,
                    "workCenterId": work_center_id,
                    "created": len(created_ids),
                    "lineIds": created_ids,
                    "rows": created_rows,
                })
                all_created_rows.extend(created_rows)
            except Exception as exc:
                conn.rollback()
                result_items.append({"workShopId": work_shop_id, "workCenterId": work_center_id, "error": str(exc)})

        # После обработки всех items — один общий дожим на день
        _recalc_for_date(conn, only_date)

    return {"success": True, "processed": created_total, "items": result_items, "rows": all_created_rows}


def soft_delete_work_schedule_line(line_id: str) -> Dict[str, Any]:
    """
    Софт-удаление одной строки по LineID (UNIQUEIDENTIFIER): DeleteMark = 1
    """
    if not line_id or not isinstance(line_id, str):
        raise ValueError("lineId is required and must be string")

    with get_connection() as conn:
        cur = conn.cursor()

        # Узнаём дату строки перед удалением
        cur.execute("SELECT OnlyDate FROM TimeLoss.WorkSchedules_ByDay WHERE LineID = ?", (line_id,))
        row = cur.fetchone()
        only_date = row[0] if row else None

        cur.execute(
            """
            UPDATE TimeLoss.WorkSchedules_ByDay
            SET DeleteMark = 1
            WHERE LineID = ?
            """,
            (line_id,),
        )
        rows = cur.rowcount or 0
        conn.commit()

        # Если дата найдена — дожимаем день
        if only_date:
            _recalc_for_date(conn, only_date)

    return {"success": True, "updated": rows}


