"""
Flask blueprint: /api/Production/WorkingCalendar
Возвращает данные рабочего календаря из Views_For_Pлан.DailyPlan_CustomWS за выбранный период
"""

from datetime import date
from flask import Blueprint, jsonify, request
from ...service.Working_Calendar.WorkingCalendar_service import (
	get_working_calendar_data,
	get_working_calendar_data_by_date_range,
	get_workshops,
	get_working_calendar_data_for_workshop,
	get_working_calendar_data_for_workshops,
)

bp = Blueprint("working_calendar_data", __name__, url_prefix="/api")


@bp.route("/Production/WorkingCalendar/workshops", methods=["GET"])
def list_workshops():
	try:
		data = get_workshops()
		return jsonify({"success": True, "data": data, "total_records": len(data)})
	except Exception as exc:
		return jsonify({"success": False, "error": str(exc)}), 500


@bp.route("/Production/WorkingCalendar", methods=["GET"])
def working_calendar_endpoint():
	"""
	Примеры:
		GET /api/Production/WorkingCalendar?year=2025&month=5
		GET /api/Production/WorkingCalendar?year=2025&month=8&workShopId=%E8%A3%85%E9%85%8D%E8%BD%A6%E9%97%B4
		GET /api/Production/WorkingCalendar?start_date=2025-05-01&end_date=2025-05-31
	"""
	# Фильтры
	year_param = request.args.get("year")
	month_param = request.args.get("month")
	work_shop_id = request.args.get("workShopId")
	# Поддержка нескольких параметров workShopId или списка workShopIds=a,b,c
	work_shop_ids_param = request.args.getlist("workShopId") or request.args.get("workShopIds")
	start_date_param = request.args.get("start_date")
	end_date_param = request.args.get("end_date")

	if year_param and month_param:
		try:
			year = int(year_param)
			month = int(month_param)
			if not (1 <= month <= 12):
				return jsonify({"error": "Месяц должен быть между 1 и 12"}), 400
		except ValueError:
			return jsonify({"error": "Неверный формат года/месяца"}), 400

		try:
			# Один или несколько цехов
			if work_shop_ids_param:
				ids = work_shop_ids_param
				if isinstance(ids, str):
					ids = [s for s in ids.split(',') if s]
				data = get_working_calendar_data_for_workshops(year, month, ids)
			elif work_shop_id:
				data = get_working_calendar_data_for_workshop(year, month, work_shop_id)
			else:
				data = get_working_calendar_data(year, month)
			return jsonify(data), 200
		except Exception as exc:
			return jsonify({"error": str(exc)}), 500

	elif start_date_param and end_date_param:
		try:
			start_date = date.fromisoformat(start_date_param)
			end_date = date.fromisoformat(end_date_param)
		except ValueError:
			return jsonify({"error": "Неверный формат даты"}), 400
		if start_date > end_date:
			return jsonify({"error": "Начальная дата позже конечной"}), 400
		try:
			data = get_working_calendar_data_by_date_range(start_date, end_date)
			return jsonify(data), 200
		except Exception as exc:
			return jsonify({"error": str(exc)}), 500

	return jsonify({"error": "Укажите параметры: year&month (+ optional workShopId/workShopIds) или start_date&end_date"}), 400


def init_app(app):
	"""Регистрирует blueprint в factory-функции Flask-приложения."""
	app.register_blueprint(bp)
