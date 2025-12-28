"""
API для загрузки Sale Plan из Excel файла
"""
from flask import Blueprint, request, jsonify
import os
from datetime import datetime
from werkzeug.utils import secure_filename
from ...service.SalePlan.SalePlan_Upload_service import parse_and_save_saleplan

bp = Blueprint('saleplan_upload', __name__, url_prefix='/api/orders/saleplan')

# Папка для загруженных файлов
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '../../../../uploads/sale_plan')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {'xlsx', 'xls'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@bp.route('/upload', methods=['POST'])
def upload_saleplan():
    """
    Загрузка Excel файла Sale Plan
    
    Формат:
    - Multipart/form-data
    - file: Excel файл
    - comment: (опционально) комментарий
    """
    try:
        # Проверяем файл
        if 'file' not in request.files:
            return jsonify({'error': 'Файл не найден'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'Файл не выбран'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Неподдерживаемый формат файла (только .xlsx или .xls)'}), 400
        
        # Получаем пользователя и комментарий
        uploaded_by = request.headers.get('X-User', 'unknown')
        comment = request.form.get('comment', None)
        
        # Сохраняем файл
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        saved_filename = f"{timestamp}_{filename}"
        file_path = os.path.join(UPLOAD_FOLDER, saved_filename)
        file.save(file_path)
        
        # Парсим и сохраняем в БД
        result = parse_and_save_saleplan(file_path, uploaded_by, comment)
        
        return jsonify({
            'success': True,
            'version_id': result['version_id'],
            'total_records': result['total_records'],
            'min_year': result['min_year'],
            'max_year': result['max_year'],
            'file_path': saved_filename,
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def init_app(app):
    app.register_blueprint(bp)

