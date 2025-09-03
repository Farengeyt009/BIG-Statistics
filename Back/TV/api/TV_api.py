from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from flask import Blueprint, jsonify, request

from ..service.TV_service import (
    fetch_hourly_planfact_range,
    fetch_idle_status_range,
    fetch_tv_workshops_allowlist,
    fetch_tv_final,
    fetch_workcenter_downtime_day,
    build_hourly_kpi_schedule,
)

bp = Blueprint("tv", __name__, url_prefix="/api/TV")


def _parse_date(param_name: str) -> date:
    value = request.args.get(param_name)
    if not value:
        raise ValueError(f"Параметр '{param_name}' обязателен и должен быть в формате YYYY-MM-DD")
    try:
        return date.fromisoformat(value)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"Неверный формат '{param_name}'. Используйте YYYY-MM-DD") from exc


def _parse_optional_datetime(param_name: str) -> Optional[datetime]:
    value = request.args.get(param_name)
    if not value:
        return None
    try:
        # Разрешаем как полную дату-время, так и только дату (интерпретируем как 00:00:00)
        if len(value) == 10:
            return datetime.fromisoformat(value + " 00:00:00")
        return datetime.fromisoformat(value)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(
            f"Неверный формат '{param_name}'. Используйте YYYY-MM-DD или YYYY-MM-DD HH:MM:SS"
        ) from exc


@bp.route("/HourlyPlanFact", methods=["GET"])
def api_hourly_planfact():
    try:
        selected_date = _parse_date("date")
        # Принимаем оба варианта ключей, чтобы не ломать фронт:
        workshop_id  = request.args.get("workshop_id")  or request.args.get("workshop_name")  or ""
        workcenter_id = request.args.get("workcenter_id") or request.args.get("workcenter_name") or ""

        payload = build_hourly_kpi_schedule(selected_date, workshop_id, workcenter_id)
        return jsonify(payload)  # ← теперь есть hourly, kpi и schedule
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@bp.route("/IdleStatus", methods=["GET"])
def api_idle_status():
    try:
        start = _parse_date("start")
        end = _parse_date("end")
        workshop_id = request.args.get("workshop_id") or None
        workcenter_id = request.args.get("workcenter_id") or None
        now_dt = _parse_optional_datetime("now")
        data = fetch_idle_status_range(start, end, workshop_id, workcenter_id, now_dt)
        return jsonify({
            "data": data,
            "start": str(start),
            "end": str(end),
            "now": (now_dt.isoformat(sep=" ") if now_dt else None),
        })
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": str(exc)}), 500


def init_app(app) -> None:
    app.register_blueprint(bp)


@bp.route("/Workshops", methods=["GET"])
def api_tv_workshops():
    try:
        data = fetch_tv_workshops_allowlist()
        return jsonify({"data": data})
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": str(exc)}), 500


@bp.route("/Final", methods=["GET"])
def api_tv_final():
    try:
        day = _parse_date("date")
        workshop_id = request.args.get("workshop_id") or None
        workcenter_id = request.args.get("workcenter_id") or None
        now_dt = _parse_optional_datetime("now")
        data = fetch_tv_final(day, workshop_id, workcenter_id, now_dt)
        return jsonify({"data": data, "date": str(day)})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": str(exc)}), 500


@bp.route("/WorkcenterDowntimeDay", methods=["GET"])
def api_workcenter_downtime_day():
    try:
        day = _parse_date("date")
        data = fetch_workcenter_downtime_day(day)
        return jsonify({"data": data, "date": str(day)})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": str(exc)}), 500


