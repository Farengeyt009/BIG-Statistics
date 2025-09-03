from flask import Blueprint, jsonify, request
from Back.Production.service.Working_Calendar.WorkingSchedules_service import (
    WorkingCalendarService,
    ConflictError,
    ValidationError,
    NotFoundError,
    DbError,
)
from typing import Dict, Any
import json

working_calendar_api = Blueprint('working_calendar_api', __name__)
working_calendar_service = WorkingCalendarService()


@working_calendar_api.route('/work-centers', methods=['GET'])
def get_work_centers():
    """
    GET /api/working-calendar/work-centers
    Получает список всех рабочих центров
    """
    try:
        work_centers = working_calendar_service.get_work_centers()

        response = {
            'success': True,
            'data': work_centers,
            'message': 'Work centers retrieved successfully',
            'count': len(work_centers)
        }

        return jsonify(response), 200

    except Exception as e:
        error_response = {
            'success': False,
            'data': [],
            'message': f'Error retrieving work centers: {str(e)}',
            'count': 0
        }
        return jsonify(error_response), 500


@working_calendar_api.route('/work-centers/<work_center_id>', methods=['GET'])
def get_work_center_by_id(work_center_id: str):
    """
    GET /api/working-calendar/work-centers/<work_center_id>
    Получает конкретный рабочий центр по ID
    """
    try:
        work_center = working_calendar_service.get_work_center_by_id(work_center_id)

        if work_center:
            response = {
                'success': True,
                'data': work_center,
                'message': 'Work center retrieved successfully'
            }
            return jsonify(response), 200
        else:
            response = {
                'success': False,
                'data': {},
                'message': f'Work center with ID {work_center_id} not found'
            }
            return jsonify(response), 404

    except Exception as e:
        error_response = {
            'success': False,
            'data': {},
            'message': f'Error retrieving work center: {str(e)}'
        }
        return jsonify(error_response), 500


@working_calendar_api.route('/work-centers/count', methods=['GET'])
def get_work_centers_count():
    """
    GET /api/working-calendar/work-centers/count
    Получает количество рабочих центров
    """
    try:
        count = working_calendar_service.get_work_centers_count()

        response = {
            'success': True,
            'data': {'count': count},
            'message': 'Work centers count retrieved successfully'
        }

        return jsonify(response), 200

    except Exception as e:
        error_response = {
            'success': False,
            'data': {'count': 0},
            'message': f'Error retrieving work centers count: {str(e)}'
        }
        return jsonify(error_response), 500


@working_calendar_api.route('/work-schedule-types', methods=['GET'])
def get_work_schedule_types():
    """
    GET /api/working-calendar/work-schedule-types
    Получает типы рабочих графиков (table2)
    """
    try:
        work_schedule_types = working_calendar_service.get_work_schedule_types()

        response = {
            'success': True,
            'data': work_schedule_types,
            'message': 'Work schedule types retrieved successfully',
            'count': len(work_schedule_types)
        }

        return jsonify(response), 200

    except Exception as e:
        error_response = {
            'success': False,
            'data': [],
            'message': f'Error retrieving work schedule types: {str(e)}',
            'count': 0
        }
        return jsonify(error_response), 500


@working_calendar_api.route('/health', methods=['GET'])
def health_check():
    """
    GET /api/working-calendar/health
    Проверка работоспособности API
    """
    try:
        # Проверяем подключение к БД, получая количество рабочих центров и типов графиков
        work_centers_count = working_calendar_service.get_work_centers_count()
        work_schedule_types = working_calendar_service.get_work_schedule_types()

        response = {
            'success': True,
            'data': {
                'status': 'healthy',
                'database_connected': True,
                'work_centers_count': work_centers_count,
                'work_schedule_types_count': len(work_schedule_types)
            },
            'message': 'Working_Calendar API is healthy'
        }

        return jsonify(response), 200

    except Exception as e:
        error_response = {
            'success': False,
            'data': {
                'status': 'unhealthy',
                'database_connected': False,
                'work_centers_count': 0,
                'work_schedule_types_count': 0
            },
            'message': f'Working_Calendar API is unhealthy: {str(e)}'
        }
        return jsonify(error_response), 500


# НОВЫЕ ENDPOINTS ДЛЯ РАБОТЫ С ГРАФИКАМИ

@working_calendar_api.route('/work-schedules', methods=['GET'])
def get_work_schedules():
    """
    GET /api/working-calendar/work-schedules?workshopId=...&includeDeleted=false
    Получает список графиков работ
    """
    try:
        workshop_id = request.args.get('workshopId')
        include_deleted = request.args.get('includeDeleted', 'false').lower() == 'true'

        # ✅ ОТЛАДКА: Логируем параметры запроса
        print(f"🔍 API: Received request - workshop_id: {workshop_id}, include_deleted: {include_deleted}")

        schedules = working_calendar_service.get_work_schedules(
            workshop_id=workshop_id,
            include_deleted=include_deleted
        )

        # ✅ ОТЛАДКА: Логируем результат
        print(f"🔍 API: Retrieved {len(schedules)} schedules")
        if schedules:
            print(f"🔍 API: First schedule workshop_id: {schedules[0].get('workshopId')}")

        response = {
            'success': True,
            'data': schedules,
            'message': 'Work schedules retrieved successfully',
            'count': len(schedules)
        }

        return jsonify(response), 200

    except Exception as e:
        print(f"🔍 API: Error in get_work_schedules: {str(e)}")
        error_response = {
            'success': False,
            'data': [],
            'message': f'Error retrieving work schedules: {str(e)}',
            'count': 0
        }
        return jsonify(error_response), 500


@working_calendar_api.route('/work-schedules/<int:schedule_id>', methods=['GET'])
def get_work_schedule_by_id(schedule_id: int):
    """
    GET /api/working-calendar/work-schedules/{id}
    Получает детали графика работ
    """
    try:
        schedule = working_calendar_service.get_work_schedule_by_id(schedule_id)

        if schedule:
            response = {
                'success': True,
                'data': schedule,
                'message': 'Work schedule retrieved successfully'
            }
            return jsonify(response), 200
        else:
            response = {
                'success': False,
                'data': {},
                'message': f'Work schedule with ID {schedule_id} not found'
            }
            return jsonify(response), 404

    except Exception as e:
        error_response = {
            'success': False,
            'data': {},
            'message': f'Error retrieving work schedule: {str(e)}'
        }
        return jsonify(error_response), 500


@working_calendar_api.route('/work-schedules', methods=['POST'])
def create_work_schedule():
    """
    POST /api/working-calendar/work-schedules
    Создает новый график работ
    """
    try:
        data = request.get_json()

        # Валидация данных
        required_fields = ['workshopId', 'name', 'isFavorite', 'lines']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': 'VALIDATION_FAILED',
                    'message': f'Missing required field: {field}'
                }), 400

        result = working_calendar_service.create_work_schedule(data)

        # result ожидаем вида: {'scheduleId': new_id, 'scheduleCode': 'WS-...', 'updatedAt': '...'}
        response = {
            'success': True,
            'data': result,
            'message': 'Work schedule created successfully'
        }
        return jsonify(response), 201

    except ConflictError as e:  # ✅ чтобы не превращалось в 500
        return jsonify({
            'success': False,
            'error': 'CONFLICT',
            'message': str(e)
        }), 409
    except ValidationError as e:
        return jsonify({
            'success': False,
            'error': 'VALIDATION_FAILED',
            'message': str(e)
        }), 400
    except Exception as e:
        error_response = {
            'success': False,
            'data': {},
            'message': f'Error creating work schedule: {str(e)}'
        }
        return jsonify(error_response), 500


@working_calendar_api.route('/work-schedules/<int:schedule_id>', methods=['PUT'])
def update_work_schedule(schedule_id: int):
    """
    PUT /api/working-calendar/work-schedules/{id}
    Обновляет график работ (замена → всегда новый ID)
    """
    try:
        data = request.get_json()

        # Валидация данных
        required_fields = ['workshopId', 'name', 'isFavorite', 'lines', 'updatedAt']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': 'VALIDATION_FAILED',
                    'message': f'Missing required field: {field}'
                }), 400

        result = working_calendar_service.update_work_schedule(schedule_id, data)

        # result ожидаем вида: {'scheduleId': new_id, 'scheduleCode': 'WS-...', 'updatedAt': '...'}
        response = {
            'success': True,
            'data': result,
            'message': 'Work schedule replaced successfully'
        }
        return jsonify(response), 200

    except ConflictError as e:
        return jsonify({
            'success': False,
            'error': 'CONFLICT',
            'message': str(e)
        }), 409
    except ValidationError as e:
        return jsonify({
            'success': False,
            'error': 'VALIDATION_FAILED',
            'message': str(e)
        }), 400
    except Exception as e:
        error_response = {
            'success': False,
            'data': {},
            'message': f'Error updating work schedule: {str(e)}'
        }
        return jsonify(error_response), 500


@working_calendar_api.route('/work-schedules/<int:schedule_id>', methods=['DELETE'])
def delete_work_schedule(schedule_id: int):
    """
    DELETE /api/working-calendar/work-schedules/{id}
    Мягкое удаление графика работ
    """
    try:
        success = working_calendar_service.delete_work_schedule(schedule_id)

        if success:
            return '', 204
        else:
            response = {
                'success': False,
                'message': 'Failed to delete work schedule'
            }
            return jsonify(response), 500

    except Exception as e:
        error_response = {
            'success': False,
            'message': f'Error deleting work schedule: {str(e)}'
        }
        return jsonify(error_response), 500


@working_calendar_api.route('/work-schedules/<int:schedule_id>/restore', methods=['POST'])
def restore_work_schedule(schedule_id: int):
    """
    POST /api/working-calendar/work-schedules/{id}/restore
    Восстанавливает удаленный график работ
    """
    try:
        success = working_calendar_service.restore_work_schedule(schedule_id)

        if success:
            response = {
                'success': True,
                'message': 'Work schedule restored successfully'
            }
            return jsonify(response), 200
        else:
            response = {
                'success': False,
                'message': 'Failed to restore work schedule'
            }
            return jsonify(response), 500

    except Exception as e:
        error_response = {
            'success': False,
            'message': f'Error restoring work schedule: {str(e)}'
        }
        return jsonify(error_response), 500


@working_calendar_api.route('/work-schedules/<int:schedule_id>/clone', methods=['POST'])
def clone_work_schedule(schedule_id: int):
    """
    POST /api/working-calendar/work-schedules/{id}/clone
    Клонирует график работ
    """
    try:
        data = request.get_json() or {}
        new_name = data.get('name')

        result = working_calendar_service.clone_work_schedule(schedule_id, new_name)

        # result ожидаем вида: {'scheduleId': new_id, 'scheduleCode': 'WS-...', 'updatedAt': '...'}
        response = {
            'success': True,
            'data': result,
            'message': 'Work schedule cloned successfully'
        }
        return jsonify(response), 201

    except NotFoundError as e:
        return jsonify({
            'success': False,
            'error': 'NOT_FOUND',
            'message': str(e)
        }), 404
    except Exception as e:
        error_response = {
            'success': False,
            'data': {},
            'message': f'Error cloning work schedule: {str(e)}'
        }
        return jsonify(error_response), 500
