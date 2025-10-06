"""
Flask blueprint: /api/Orders/Shipment
Возвращает данные об отгрузках из Orders.ShipmentData_Table за выбранный период.
"""

from datetime import date
from flask import Blueprint, jsonify, request
from ..service.Shipment_service import (
    get_shipment_data,
    load_published_rules,
    preview_shipment_data,
    publish_rules,
)

bp = Blueprint("orders_shipment", __name__, url_prefix="/api")


@bp.route("/Orders/Shipment", methods=["GET"])
def orders_shipment_endpoint():
    """
    Пример запроса:
      GET /api/Orders/Shipment?start_date=2025-01-01&end_date=2025-01-31

    Параметры:
      - start_date: начальная дата (YYYY-MM-DD)
      - end_date:   конечная дата (YYYY-MM-DD)

    Формат ответа:
      {
        "data": [...],
        "start_date": "01.01.2025",
        "end_date": "31.01.2025",
        "total_records": 123
      }
    """
    start_date_param = request.args.get("start_date")
    end_date_param = request.args.get("end_date")

    if not start_date_param or not end_date_param:
        return jsonify({"error": "Необходимо указать параметры start_date и end_date"}), 400

    try:
        start_date_val = date.fromisoformat(start_date_param)
        end_date_val = date.fromisoformat(end_date_param)
    except ValueError:
        return jsonify({"error": "Неверный формат даты. Используйте YYYY-MM-DD"}), 400

    if start_date_val > end_date_val:
        return jsonify({"error": "Начальная дата не может быть позже конечной даты"}), 400

    try:
        data = get_shipment_data(start_date_val, end_date_val)
        # Для удобства фронта отдадим даты в формате DD.MM.YYYY
        data["start_date"] = start_date_val.strftime('%d.%m.%Y')
        data["end_date"] = end_date_val.strftime('%d.%m.%Y')
        return jsonify(data), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


# ---- НОВОЕ: отдать опубликованные правила для модалки ----
@bp.route("/Orders/Shipment/filters", methods=["GET"])
def shipment_filters_get():
    try:
        from ...database.db_connector import get_connection
        with get_connection() as conn:
            rules = load_published_rules(conn)
        return jsonify({"rules": rules, "total": len(rules)}), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


# ---- НОВОЕ: PREVIEW с временными правилами (без записи в БД) ----
@bp.route("/Orders/Shipment/preview", methods=["POST"])
def shipment_preview():
    payload = request.get_json(silent=True) or {}
    try:
        start_date_val = date.fromisoformat(payload.get("start_date"))
        end_date_val = date.fromisoformat(payload.get("end_date"))
    except Exception:
        return jsonify({"error": "start_date/end_date в формате YYYY-MM-DD"}), 400

    mode = (payload.get("mode") or "merge").lower()
    if mode not in ("merge", "override"):
        mode = "merge"

    rules = payload.get("rules") or []
    if not isinstance(rules, list):
        return jsonify({"error": "rules должен быть массивом"}), 400

    try:
        data = preview_shipment_data(start_date_val, end_date_val, rules, mode=mode)
        data["start_date"] = start_date_val.strftime('%d.%m.%Y')
        data["end_date"]   = end_date_val.strftime('%d.%m.%Y')
        return jsonify(data), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


# ---- НОВОЕ: PUBLISH — заменить набор правил в БД ----
@bp.route("/Orders/Shipment/filters/publish", methods=["POST"])
def shipment_filters_publish():
    payload = request.get_json(silent=True) or {}
    rules = payload.get("rules")
    if not isinstance(rules, list):
        return jsonify({"error": "rules должен быть массивом объектов правил"}), 400

    try:
        inserted = publish_rules(rules)
        return jsonify({"ok": True, "inserted": inserted}), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

def init_app(app):
    """Регистрирует blueprint в factory-функции Flask-приложения."""
    app.register_blueprint(bp)


