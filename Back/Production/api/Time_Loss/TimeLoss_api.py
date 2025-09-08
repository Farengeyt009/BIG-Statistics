from flask import Blueprint, request, jsonify
from datetime import datetime
from Back.Production.service.Time_Loss.TimeLoss_service import TimeLossService
from Back.database.db_connector import get_connection
import logging

log = logging.getLogger("timeloss")

timeloss_router = Blueprint('timeloss', __name__)

@timeloss_router.route('/timeloss/entries')
def get_entries():
    """Get time loss entries by date or date range.

    Supports either:
      - ?date=YYYY-MM-DD (single day)
      - ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD (inclusive range)
    Optional: &workshop=WS&workcenter=WC&limit=1000
    """
    try:
        date = request.args.get('date')
        start_date = request.args.get('startDate')
        end_date = request.args.get('endDate')

        workshop = request.args.get('workshop')
        workcenter = request.args.get('workcenter')
        limit = request.args.get('limit', default=5000, type=int)

        service = TimeLossService(get_connection())

        if start_date and end_date:
            entries = service.get_entries_range(start_date, end_date, workshop, workcenter, limit)
        elif date:
            entries = service.get_entries(date, workshop, workcenter, limit)
        else:
            return jsonify({'error': 'date or startDate/endDate is required'}), 400

        return jsonify(entries)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception:
        log.exception("GET /timeloss/entries failed")
        return jsonify({'error': 'INTERNAL_ERROR'}), 500

@timeloss_router.route('/timeloss/entry/<int:id>', methods=['PATCH'])
def update_entry(id):
    """Update a single field in an entry"""
    try:
        data = request.get_json()
        field = data.get('field')
        value = data.get('value')
        rowver = data.get('rowver')

        if not field:
            return jsonify({'error': 'Field is required'}), 400

        service = TimeLossService(get_connection())
        result = service.update_entry(id, field, value, rowver)
        return jsonify(result)
    except ValueError as e:
        if str(e) == "ROWVER_MISMATCH":
            return jsonify({'error': 'Row version mismatch'}), 409
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        log.exception("update_entry failed")
        return jsonify({'error': 'INTERNAL_ERROR'}), 500

@timeloss_router.route('/timeloss/entry', methods=['POST'])
def create_entry():
    """Create a new time loss entry"""
    try:
        entry = request.get_json()
        service = TimeLossService(get_connection())
        result = service.create_entry(entry)
        return jsonify(result), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        log.exception("create_entry failed")
        return jsonify({'error': 'INTERNAL_ERROR'}), 500

@timeloss_router.route('/timeloss/entry/<int:id>/copy', methods=['POST'])
def copy_entry(id):
    """Copy an existing entry"""
    try:
        data = request.get_json() or {}
        new_date = data.get('newDate')
        new_workcenter_id = data.get('newWorkCenterID')

        service = TimeLossService(get_connection())
        result = service.copy_entry(id, new_date, new_workcenter_id)
        return jsonify(result), 201
    except Exception as e:
        log.exception("copy_entry failed")
        return jsonify({'error': 'INTERNAL_ERROR'}), 500

@timeloss_router.route('/timeloss/entry/<int:id>/delete', methods=['POST'])
def delete_entry(id):
    """Soft delete an entry"""
    try:
        service = TimeLossService(get_connection())
        service.delete_entry(id)
        return jsonify({'ok': True})
    except Exception as e:
        log.exception("delete_entry failed")
        return jsonify({'error': 'INTERNAL_ERROR'}), 500

@timeloss_router.route('/timeloss/dicts')
def get_dictionaries():
    """Get all dictionaries for dropdowns"""
    try:
        service = TimeLossService(get_connection())
        result = service.get_dictionaries()
        return jsonify(result)
    except Exception as e:
        log.exception("get_dictionaries failed")
        return jsonify({'error': 'INTERNAL_ERROR'}), 500