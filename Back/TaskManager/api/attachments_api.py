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
        mime_type = file.content_type or "application/octet-stream"
        
        # Создаем запись в БД с оригинальным именем (с кириллицей)
        attachment_id = AttachmentsService.create_attachment(
            task_id=task_id,
            user_id=user_data["user_id"],
            file_name=original_filename,  # Оригинальное имя с кириллицей
            file_path=str(file_path),
            file_size=file_size,
            mime_type=mime_type
        )

        # Для изображений создаем миниатюру заранее, чтобы список файлов
        # открывался быстро и без скачивания оригинала.
        AttachmentsService.ensure_thumbnail(str(file_path), mime_type)
        
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


@bp.route("/project/<int:project_id>", methods=["GET"])
def get_project_attachments(project_id):
    """Получить все вложения проекта"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401
        
        attachments = AttachmentsService.get_project_attachments(project_id, user_data["user_id"])
        return jsonify({"success": True, "data": attachments}), 200
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
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


@bp.route("/<int:attachment_id>/preview", methods=["GET"])
def preview_attachment(attachment_id):
    """Открыть вложение inline (для изображений) без скачивания"""
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

        mime_type = attachment.get('mime_type') or ''
        if not mime_type.startswith('image/'):
            return jsonify({"success": False, "error": "Предпросмотр доступен только для изображений"}), 400

        return send_file(
            file_path,
            as_attachment=False,
            download_name=attachment['file_name'],
            mimetype=mime_type
        )
    except PermissionError as e:
        return jsonify({"success": False, "error": str(e)}), 403
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bp.route("/<int:attachment_id>/thumbnail", methods=["GET"])
def thumbnail_attachment(attachment_id):
    """Получить миниатюру изображения"""
    try:
        user_data = get_current_user()
        if not user_data:
            return jsonify({"success": False, "error": "Не авторизован"}), 401

        attachment = AttachmentsService.get_attachment_by_id(attachment_id, user_data["user_id"])
        if not attachment:
            return jsonify({"success": False, "error": "Файл не найден"}), 404

        mime_type = attachment.get('mime_type') or ''
        if not mime_type.startswith('image/'):
            return jsonify({"success": False, "error": "Thumbnail доступен только для изображений"}), 400

        thumb = AttachmentsService.ensure_thumbnail(attachment['file_path'], mime_type)
        if not thumb or not thumb.exists():
            return jsonify({"success": False, "error": "Не удалось создать thumbnail"}), 500

        return send_file(
            thumb,
            as_attachment=False,
            mimetype="image/jpeg"
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
