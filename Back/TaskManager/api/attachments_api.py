"""
Flask API: управление вложениями Task Manager
"""
from flask import Blueprint, jsonify, request, send_file
from werkzeug.utils import secure_filename
from ..service.attachments_service import AttachmentsService
from Back.Users.service.auth_service import verify_jwt_token
from pathlib import Path
import uuid

bp = Blueprint("task_manager_attachments", __name__, url_prefix="/api/task-manager/attachments")


def get_current_user():
    """Получить текущего пользователя из токена"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ')[1]
    return verify_jwt_token(token)


@bp.route("/task/<int:task_id>", methods=["GET"])
def get_task_attachments(task_id):
    """Получить все вложения задачи"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        attachments = AttachmentsService.get_task_attachments(task_id, user_data["user_id"])
        return jsonify({"success": True, "data": attachments}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/task/<int:task_id>", methods=["POST"])
def upload_attachment(task_id):
    """Загрузить файл к задаче"""
    file_path = None
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        if 'file' not in request.files:
            return jsonify({"success": False, "error": "Файл не предоставлен"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"success": False, "error": "Файл не выбран"}), 400
        
        # Создаем папку для проекта
        project_folder = AttachmentsService.get_project_folder(task_id)
        
        # Генерируем уникальное имя файла
        # Сохраняем оригинальное имя БЕЗ secure_filename чтобы сохранить кириллицу
        original_filename = file.filename
        
        # Для сохранения на диск используем UUID + расширение
        file_extension = Path(original_filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = project_folder / unique_filename
        
        # Сохраняем файл
        file.save(str(file_path))
        file_size = file_path.stat().st_size
        
        # Создаем запись в БД с оригинальным именем (с кириллицей)
        attachment_id = AttachmentsService.create_attachment(
            task_id=task_id,
            user_id=user_data["user_id"],
            file_name=original_filename,  # Оригинальное имя с кириллицей
            file_path=str(file_path),
            file_size=file_size,
            mime_type=file.content_type or "application/octet-stream"
        )
        
        return jsonify({
            "success": True,
            "message": "Файл загружен",
            "data": {
                "id": attachment_id,
                "file_name": original_filename,
                "file_size": file_size
            }
        }), 201
    except PermissionError as e:
        # Удаляем файл при ошибке
        if file_path and Path(file_path).exists():
            Path(file_path).unlink()
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        # Удаляем файл при ошибке
        if file_path and Path(file_path).exists():
            Path(file_path).unlink()
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/<int:attachment_id>/download", methods=["GET"])
def download_attachment(attachment_id):
    """Скачать файл"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        attachment = AttachmentsService.get_attachment_by_id(attachment_id, user_data["user_id"])
        
        if not attachment:
            return jsonify({"success": False, "error": "Файл не найден"}), 404
        
        file_path = Path(attachment['file_path'])
        
        if not file_path.exists():
            return jsonify({"success": False, "error": "Файл не найден на сервере"}), 404
        
        return send_file(
            file_path,
            as_attachment=True,
            download_name=attachment['file_name'],
            mimetype=attachment['mime_type']
        )
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/<int:attachment_id>", methods=["DELETE"])
def delete_attachment(attachment_id):
    """Удалить вложение"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        AttachmentsService.delete_attachment(attachment_id, user_data["user_id"])
        return jsonify({"success": True, "message": "Файл удален"}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def init_app(app):
    """Регистрация blueprint в приложении"""
    app.register_blueprint(bp)
