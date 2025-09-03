from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional

try:
    from zoneinfo import ZoneInfo  # Python 3.9+
except Exception:  # pragma: no cover
    ZoneInfo = None  # type: ignore

from Back.database.db_connector import get_connection


def _serialize_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime,)):
        return value.isoformat(sep=" ")
    return value


def _rows_to_dicts(columns: List[str], rows: List[tuple]) -> List[Dict[str, Any]]:
    result: List[Dict[str, Any]] = []
    for row in rows:
        record = {col: _serialize_value(val) for col, val in zip(columns, row)}
        result.append(record)
    return result


def _beijing_now_naive() -> datetime:
    # Возвращает текущее пекинское время как naive datetime (стенка MSSQL ожидает без tzinfo)
    if ZoneInfo is not None:
        return datetime.now(ZoneInfo("Asia/Shanghai")).replace(tzinfo=None)
    # Фолбэк: UTC+8
    return (datetime.utcnow() + timedelta(hours=8))


# fetch_tv_order_slots удалён по просьбе — источником данных для таблицы стал fn_TV_Final


def fetch_hourly_planfact_range(
    selected_date: date,
    workshop_name: str,
    workcenter_name: str,
) -> List[Dict[str, Any]]:
    sql = (
        """
        SELECT WorkShopID, WorkCenterID, HourStart, HourLabel, PlanQty, FactQty
        FROM Production_TV.fn_TV_Hourly(?, ?, ?)
        ORDER BY HourStart;
        """
    )
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, (selected_date, workshop_name, workcenter_name))
        columns = [col[0] for col in cursor.description]
        rows = cursor.fetchall()
    return _rows_to_dicts(columns, rows)


def _fmt_hhmm(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    return dt.strftime("%H:%M")


def _minutes_between(a: datetime, b: datetime) -> int:
    return max(0, int((b - a).total_seconds() // 60))


def _fetch_working_spans_day(
    selected_date: date,
    workshop_id: str,
    workcenter_id: str,
) -> List[Dict[str, Any]]:
    """
    Пытаемся взять кэшированные спаны из Production_TV.Cache_WorkingSpans_Day.
    Если пусто — используем функцию Production_TV.fn_WorkingSpans_Day.
    Возвращаем список словарей с ключами: SpanStart, SpanEnd (datetime).
    """
    with get_connection() as conn:
        cursor = conn.cursor()

        # 1) правильный кэш
        sql_cache = """
            SELECT OnlyDate, WorkShopID, WorkCenterID, SpanStart, SpanEnd
            FROM Production_TV.Cache_WorkingSpans_Day WITH (NOLOCK)
            WHERE OnlyDate   = ?
              AND WorkShopID = ?
              AND WorkCenterID = ?
            ORDER BY SpanStart
        """
        cursor.execute(sql_cache, (selected_date, workshop_id, workcenter_id))
        rows = cursor.fetchall()
        if rows:
            columns = [c[0] for c in cursor.description]
            return _rows_to_dicts(columns, rows)

        # 2) fallback-функция (оставляем как есть)
        sql_fn = """
            SELECT SpanStart, SpanEnd
            FROM Production_TV.fn_WorkingSpans_Day(?, ?, ?)
            ORDER BY SpanStart
        """
        cursor.execute(sql_fn, (selected_date, workshop_id, workcenter_id))
        rows = cursor.fetchall()
        columns = [c[0] for c in cursor.description]
        return _rows_to_dicts(columns, rows)


def _compute_schedule(
    spans: List[Dict[str, Any]],
    now_dt: Optional[datetime] = None,
    min_break_min: int = 5,
) -> Dict[str, Any]:
    """
    Строит расписание: первая смена, конец работы, перерывы, следующий перерыв, остаток до конца.
    Поля времени форматируются как HH:MM (строка), кроме end_remain_min (минуты).
    """
    if not now_dt:
        now_dt = _beijing_now_naive()

    if not spans:
        return {
            "first_start": "",
            "end_of_work": "",
            "end_remain_min": 0,
            "breaks": [],
            "next_break": {"status": "none", "from": "", "to": "", "dur_min": 0, "remain_min": 0},
        }

    # Преобразуем в datetime
    span_pairs: List[tuple[datetime, datetime]] = []
    for it in spans:
        s = it.get("SpanStart")
        e = it.get("SpanEnd")
        if isinstance(s, str):
            s = datetime.fromisoformat(s)
        if isinstance(e, str):
            e = datetime.fromisoformat(e)
        if not s or not e:
            continue
        span_pairs.append((s, e))

    if not span_pairs:
        return {
            "first_start": "",
            "end_of_work": "",
            "end_remain_min": 0,
            "breaks": [],
            "next_break": {"status": "none", "from": "", "to": "", "dur_min": 0, "remain_min": 0},
        }

    # Отсортируем спаны по старту и определим границы первой/последней смены
    span_pairs_sorted = sorted(span_pairs, key=lambda p: p[0])
    first_start_dt = span_pairs_sorted[0][0]
    end_of_work_dt = span_pairs_sorted[-1][1]
    breaks: List[Dict[str, Any]] = []
    for i in range(1, len(span_pairs_sorted)):
        prev_end = span_pairs_sorted[i - 1][1]
        next_start = span_pairs_sorted[i][0]
        gap_min = _minutes_between(prev_end, next_start)
        if gap_min >= min_break_min:
            breaks.append({
                "from": _fmt_hhmm(prev_end),
                "to": _fmt_hhmm(next_start),
                "dur_min": gap_min,
                # служебные поля для вычислений
                "_from_dt": prev_end,
                "_to_dt": next_start,
            })

    # Определяем next_break
    next_break: Dict[str, Any] = {"status": "none", "from": None, "to": None, "dur_min": 0, "remain_min": 0}
    ongoing_candidate: Optional[Dict[str, Any]] = None
    upcoming_candidate: Optional[Dict[str, Any]] = None
    for b in breaks:
        from_dt = b["_from_dt"]
        to_dt = b["_to_dt"]
        if from_dt <= now_dt < to_dt:
            ongoing_candidate = b
            break
        if from_dt > now_dt and (upcoming_candidate is None or from_dt < upcoming_candidate["_from_dt"]):
            upcoming_candidate = b

    if ongoing_candidate is not None:
        remain = _minutes_between(now_dt, ongoing_candidate["_to_dt"])  # до конца перерыва
        next_break = {
            "status": "ongoing",
            "from": ongoing_candidate["from"],
            "to": ongoing_candidate["to"],
            "dur_min": ongoing_candidate["dur_min"],
            "remain_min": remain,
        }
    elif upcoming_candidate is not None:
        next_break = {
            "status": "upcoming",
            "from": upcoming_candidate["from"],
            "to": upcoming_candidate["to"],
            "dur_min": upcoming_candidate["dur_min"],
            "remain_min": 0,
        }

    # Остаток до конца смены (0, если уже прошло)
    end_remain_min = max(0, int((end_of_work_dt - now_dt).total_seconds() // 60))

    # Удаляем служебные поля из breaks
    for b in breaks:
        b.pop("_from_dt", None)
        b.pop("_to_dt", None)

    return {
        "first_start": _fmt_hhmm(first_start_dt),
        "end_of_work": _fmt_hhmm(end_of_work_dt) or "",  # ВСЕГДА строка, если спаны есть
        "end_remain_min": end_remain_min,
        "breaks": breaks,
        "next_break": next_break,
    }


def _fetch_final_totals(
    selected_date: date,
    workshop_id: Optional[str],
    workcenter_id: Optional[str],
    now_dt: datetime,
) -> tuple[Decimal, Decimal]:
    sql = """
        SELECT
          SUM(CAST([Total Plan] AS decimal(18,4))) AS PlanTotal,
          SUM(CAST([Fact]       AS decimal(18,4))) AS FactTotal
        FROM Production_TV.fn_TV_Final(?, ?, ?, ?)
    """
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(sql, (selected_date, workshop_id, workcenter_id, now_dt))
        row = cur.fetchone() or (0, 0)
    p = Decimal(row[0] or 0)
    f = Decimal(row[1] or 0)
    return p, f


def _fetch_people_max(
    selected_date: date,
    workshop_id: str,
    workcenter_id: str,
) -> int:
    sql = (
        """
        SELECT ISNULL(MAX(CAST(t1.People AS int)), 0) AS PeopleMax
        FROM TimeLoss.WorkSchedules_ByDay AS t1 WITH (NOLOCK)
        LEFT JOIN Production_TV.Workshops_Allowlist AS t2
          ON t2.WorkShopID = t1.WorkShopID
        WHERE t1.DeleteMark = 0
          AND t1.OnlyDate   = ?
          AND t2.WorkShopID IS NOT NULL
          AND t1.WorkShopID   = ?
          AND t1.WorkCenterID = ?
        """
    )
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, (selected_date, workshop_id, workcenter_id))
        row = cursor.fetchone()
        if not row:
            return 0
        people = row[0]
        try:
            return int(people)
        except Exception:
            return 0


def build_hourly_kpi_schedule(
    selected_date: date,
    workshop_id: str,
    workcenter_id: str,
    now_dt: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Собирает за один вызов: hourly, kpi агрегаты и расписание с перерывами.
    Возвращает структуру, готовую к JSON согласно договорённости.
    """
    if now_dt is None:
        now_dt = _beijing_now_naive()

    # Hourly rows (безопасно)
    try:
        hourly_rows = fetch_hourly_planfact_range(selected_date, workshop_id, workcenter_id)
    except Exception:
        hourly_rows = []

    # --- KPI агрегаты считаем по FINAL, не по Hourly ---
    try:
        plan_total_dec, fact_total_dec = _fetch_final_totals(
            selected_date, workshop_id, workcenter_id, now_dt
        )
    except Exception:
        # fallback: если FINAL недоступен — старый способ по Hourly
        def _dec(x) -> Decimal:
            try: return Decimal(str(x)) if x is not None else Decimal(0)
            except Exception: return Decimal(0)
        plan_total_dec = sum((_dec(r.get("PlanQty")) for r in hourly_rows), Decimal(0))
        fact_total_dec = sum((_dec(r.get("FactQty")) for r in hourly_rows), Decimal(0))

    plan_total = int(plan_total_dec.to_integral_value(rounding=ROUND_HALF_UP))
    fact_total = int(fact_total_dec.to_integral_value(rounding=ROUND_HALF_UP))

    compl_pct = int(((fact_total_dec / plan_total_dec) * Decimal(100))
                    .to_integral_value(rounding=ROUND_HALF_UP)) if plan_total_dec > 0 else 0
    left_qty = max(plan_total - fact_total, 0)
    over_qty = max(fact_total - plan_total, 0)

    # Schedule (безопасно)
    try:
        spans = _fetch_working_spans_day(selected_date, workshop_id, workcenter_id)
        schedule = _compute_schedule(spans, now_dt=now_dt)
    except Exception:
        schedule = {
            "first_start": "",
            "end_of_work": "",
            "end_remain_min": 0,
            "breaks": [],
            "next_break": {"status": "none", "from": "", "to": "", "dur_min": 0, "remain_min": 0},
        }

    # People (безопасно)
    try:
        people = _fetch_people_max(selected_date, workshop_id, workcenter_id)
    except Exception:
        people = 0

    return {
        "date": str(selected_date),
        "as_of": now_dt.strftime("%Y-%m-%d %H:%M:%S"),
        "tz": "+08:00",
        "hourly": hourly_rows,
        "kpi": {
            "plan_total": plan_total,
            "fact_total": fact_total,
            "compl_pct": compl_pct,
            "left_qty": left_qty,
            "over_qty": over_qty,
            "people": people,
        },
        "schedule": schedule,
    }

def fetch_idle_status_range(
    start_date: date,
    end_date: date,
    workshop_id: Optional[str] = None,
    workcenter_id: Optional[str] = None,
    now_beijing: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    # Если now не передан, берём текущее пекинское время
    now_dt = now_beijing or _beijing_now_naive()
    sql = (
        """
        SELECT *
        FROM Production_TV.fn_IdleStatus_Range(?, ?, ?, ?, ?)
        """
    )
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, (start_date, end_date, workshop_id, workcenter_id, now_dt))
        columns = [col[0] for col in cursor.description]
        rows = cursor.fetchall()
    return _rows_to_dicts(columns, rows)


def fetch_tv_workshops_allowlist() -> List[Dict[str, Any]]:
    sql = (
        """
        SELECT
            Ref.WorkShop_CustomWS.WorkShop_CustomWS,
            Ref.WorkShop_CustomWS.WorkCenter_CustomWS,
            Ref.WorkShop_CustomWS.WorkShopName_ZH,
            Ref.WorkShop_CustomWS.WorkShopName_EN,
            Ref.WorkShop_CustomWS.WorkCenterName_ZH,
            Ref.WorkShop_CustomWS.WorkCenterName_EN
        FROM Ref.WorkShop_CustomWS
        LEFT JOIN Production_TV.Workshops_Allowlist AS t1
            ON t1.WorkShopID = Ref.WorkShop_CustomWS.WorkShop_CustomWS
        WHERE t1.WorkShopID IS NOT NULL
        """
    )
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql)
        columns = [col[0] for col in cursor.description]
        rows = cursor.fetchall()
    return _rows_to_dicts(columns, rows)


def fetch_tv_final(
    day: date,
    workshop_id: Optional[str] = None,
    workcenter_id: Optional[str] = None,
    now_beijing: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """
    Возвращает строки для таблицы TV из Production_TV.fn_TV_Final.
    Аргументы:
      - day: выбранная дата (single day)
      - workshop_id, workcenter_id: фильтры (обычно None — берём все и фильтруем на фронте)
      - now_beijing: текущее пекинское время (если не указано — берём локально)
    """
    now_dt = now_beijing or _beijing_now_naive()
    sql = (
        """
        SELECT *
        FROM Production_TV.fn_TV_Final(?, ?, ?, ?)
        Order by TimeSlot
        """
    )
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, (day, workshop_id, workcenter_id, now_dt))
        columns = [col[0] for col in cursor.description]
        rows = cursor.fetchall()
    return _rows_to_dicts(columns, rows)


def fetch_workcenter_downtime_day(day: date) -> List[Dict[str, Any]]:
    """
    Возвращает строки из Production_TV.fn_TV_Workcenter_Downtime_Day
    за указанный день. Используются параметры (day, NULL, 5, NULL),
    результат отсортирован по WorkCenter_CN.
    """
    sql = (
        """
        SELECT *
        FROM Production_TV.fn_TV_Workcenter_Downtime_Day(?, NULL, 5, NULL)
        ORDER BY WorkCenter_CN;
        """
    )
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, (day,))
        columns = [col[0] for col in cursor.description]
        rows = cursor.fetchall()
    return _rows_to_dicts(columns, rows)


