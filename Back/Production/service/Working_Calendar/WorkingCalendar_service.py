"""
Сервис-слой: возвращает данные рабочего календаря из Views_For_Plan.DailyPlan_CustomWS
"""

from datetime import date
from datetime import timedelta
from typing import Any, Dict, List, Optional
from ....database.db_connector import get_connection


def _fetch_query(conn, sql: str, *params) -> List[Dict[str, Any]]:
	"""Выполняет SELECT и возвращает список dict'ов (JSON-friendly)."""
	cur = conn.cursor()
	cur.execute(sql, *params)
	cols = [c[0] for c in cur.description]
	return [dict(zip(cols, row)) for row in cur.fetchall()]


def _build_universal_sql(work_shop_ids: Optional[List[str]]) -> str:
	"""Строит универсальный SQL (CTE) с опциональным фильтром по цехам."""
	ws_filter_dp = ""
	ws_filter_wsbd = ""
	if work_shop_ids:
		placeholders = ", ".join(["?"] * len(work_shop_ids))
		ws_filter_dp = f"\n\t\tAND WorkShopName_CH IN ({placeholders})"
		ws_filter_wsbd = f"\n\t\tAND WorkShopID IN ({placeholders})"
	return f"""
	;WITH T1A AS (
		SELECT OnlyDate, SUM(FACT_TIME) AS Prod_Time
		FROM Views_For_Plan.DailyPlan_CustomWS
		WHERE OnlyDate >= ?
		  AND OnlyDate <  ?{ws_filter_dp}
		GROUP BY OnlyDate
	),
	T2A AS (
		SELECT OnlyDate, SUM(PeopleWorkHours) AS Shift_Time, SUM(People) AS People
		FROM TimeLoss.WorkSchedules_ByDay
		WHERE DeleteMark = 0
		  AND OnlyDate >= ?
		  AND OnlyDate <  ?{ws_filter_wsbd}
		GROUP BY OnlyDate
	)
	SELECT a.OnlyDate,
	       a.Prod_Time,
	       COALESCE(b.Shift_Time, 0) AS Shift_Time,
	       CAST(50 AS int)           AS Time_Loss,
	       COALESCE(b.People, 0)     AS People
	FROM T1A a
	LEFT JOIN T2A b ON b.OnlyDate = a.OnlyDate
	ORDER BY a.OnlyDate;
	"""


def _format_only_date_fields(rows: List[Dict[str, Any]]) -> None:
	"""Форматирует поле OnlyDate в dd.mm.YYYY, если это date/datetime или ISO-строка."""
	for row in rows:
		val = row.get('OnlyDate')
		if not val:
			continue
		if hasattr(val, 'strftime'):
			row['OnlyDate'] = val.strftime('%d.%m.%Y')
			continue
		try:
			from datetime import datetime
			row['OnlyDate'] = datetime.fromisoformat(str(val).split('T')[0]).strftime('%d.%m.%Y')
		except Exception:
			pass


def _get_calendar_data_universal(start_date: date, end_date_exclusive: date, work_shop_ids: Optional[List[str]] = None) -> List[Dict[str, Any]]:
	sql = _build_universal_sql(work_shop_ids)
	params: List[Any] = [start_date, end_date_exclusive]
	if work_shop_ids:
		params.extend(work_shop_ids)
	params.extend([start_date, end_date_exclusive])
	if work_shop_ids:
		params.extend(work_shop_ids)
	with get_connection() as conn:
		rows = _fetch_query(conn, sql, tuple(params))
		_format_only_date_fields(rows)
		return rows


def get_workshops() -> List[Dict[str, Any]]:
	"""Возвращает список цехов (ID + локализованные имена)."""
	sql = """
	SELECT DISTINCT 
		WorkShop_CustomWS AS workShopId,
		WorkShopName_ZH,
		WorkShopName_EN
	FROM Ref.WorkShop_CustomWS
	ORDER BY WorkShop_CustomWS
	"""
	with get_connection() as conn:
		return _fetch_query(conn, sql)


def get_working_calendar_data(year: int, month: int) -> Dict[str, Any]:
	"""
	Возвращает данные рабочего календаря за выбранный год и месяц
	"""
	month_start = date(year, month, 1)
	# первое число следующего месяца как эксклюзивная граница
	if month == 12:
		end_exclusive = date(year + 1, 1, 1)
	else:
		end_exclusive = date(year, month + 1, 1)
	try:
		rows = _get_calendar_data_universal(month_start, end_exclusive, None)
		return {
			"data": rows,
			"year": year,
			"month": month,
			"total_records": len(rows)
		}
	except Exception as e:
		raise Exception(f"Ошибка при получении данных рабочего календаря: {str(e)}")


def get_working_calendar_data_for_workshop(year: int, month: int, work_shop_id: str) -> Dict[str, Any]:
	"""Возвращает данные календаря за месяц с фильтром по ID цеха."""
	month_start = date(year, month, 1)
	if month == 12:
		end_exclusive = date(year + 1, 1, 1)
	else:
		end_exclusive = date(year, month + 1, 1)
	rows = _get_calendar_data_universal(month_start, end_exclusive, [work_shop_id])
	return {
		"data": rows,
		"year": year,
		"month": month,
		"workShopId": work_shop_id,
		"total_records": len(rows)
	}


def get_working_calendar_data_for_workshops(year: int, month: int, work_shop_ids: List[str]) -> Dict[str, Any]:
	"""Возвращает данные календаря за месяц с фильтром по нескольким ID цехов."""
	month_start = date(year, month, 1)
	if month == 12:
		end_exclusive = date(year + 1, 1, 1)
	else:
		end_exclusive = date(year, month + 1, 1)
	rows = _get_calendar_data_universal(month_start, end_exclusive, work_shop_ids)
	return {
		"data": rows,
		"year": year,
		"month": month,
		"workShopIds": work_shop_ids,
		"total_records": len(rows)
	}


def get_working_calendar_data_by_date_range(start_date: date, end_date: date) -> Dict[str, Any]:
	"""
	Возвращает данные рабочего календаря за выбранный период
	"""
	# [start_date, end_date] -> [start_date, end_date+1) для использования "< end_exclusive"
	end_exclusive = end_date + timedelta(days=1)
	try:
		rows = _get_calendar_data_universal(start_date, end_exclusive, None)
		return {
			"data": rows,
			"start_date": start_date.strftime('%d.%m.%Y'),
			"end_date": end_date.strftime('%d.%m.%Y'),
			"total_records": len(rows)
		}
	except Exception as e:
		raise Exception(f"Ошибка при получении данных рабочего календаря: {str(e)}")
