"""
Сервис для работы с аватарками пользователей
"""

import os
from PIL import Image
from werkzeug.utils import secure_filename
from typing import Tuple, Optional

# Настройки
# Путь относительно корня проекта (где находится Run_Server.py)
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
AVATAR_DIR = os.path.join(BASE_DIR, 'Front', 'big-statistics-dashboard', 'public')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
AVATAR_SIZE = (200, 200)  # Размер аватарки после сжатия


def allowed_file(filename: str) -> bool:
    """Проверяет допустимость расширения файла"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def get_avatar_filename(user_id: int, extension: str = 'png') -> str:
    """Генерирует имя файла аватарки для пользователя (всегда PNG)"""
    return f'avatar_{user_id}.png'


def delete_old_avatar(user_id: int) -> None:
    """Удаляет старую аватарку пользователя"""
    # Удаляем PNG (основной формат)
    old_file = os.path.join(AVATAR_DIR, f'avatar_{user_id}.png')
    if os.path.exists(old_file):
        try:
            os.remove(old_file)
            print(f"Удалена старая аватарка: {old_file}")
        except Exception as e:
            print(f"Ошибка удаления {old_file}: {e}")
    
    # Также проверяем и удаляем старые файлы других форматов (для обратной совместимости)
    for ext in ['jpg', 'jpeg', 'gif', 'webp']:
        old_file = os.path.join(AVATAR_DIR, f'avatar_{user_id}.{ext}')
        if os.path.exists(old_file):
            try:
                os.remove(old_file)
                print(f"Удалена старая аватарка (устаревший формат): {old_file}")
            except Exception as e:
                print(f"Ошибка удаления {old_file}: {e}")


def save_avatar(user_id: int, file) -> Tuple[bool, str]:
    """
    Сохраняет аватарку пользователя.
    
    Args:
        user_id: ID пользователя
        file: Файл из request.files
    
    Returns:
        (success, message/filename)
    """
    try:
        # Проверка наличия файла
        if not file or file.filename == '':
            return False, 'Файл не выбран'
        
        # Проверка расширения
        if not allowed_file(file.filename):
            return False, f'Недопустимый формат. Разрешены: {", ".join(ALLOWED_EXTENSIONS)}'
        
        # Проверка размера файла
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > MAX_FILE_SIZE:
            return False, f'Файл слишком большой. Максимум {MAX_FILE_SIZE // (1024*1024)}MB'
        
        # Открываем изображение через Pillow (дополнительная валидация)
        try:
            img = Image.open(file)
            img.verify()  # Проверяем что это действительно изображение
            file.seek(0)  # Возвращаем указатель на начало
            img = Image.open(file)
        except Exception:
            return False, 'Файл не является изображением'
        
        # Конвертируем в RGB (если PNG с прозрачностью)
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Изменяем размер (сжимаем)
        img.thumbnail(AVATAR_SIZE, Image.Resampling.LANCZOS)
        
        # Генерируем имя нового файла (всегда .png)
        filename = get_avatar_filename(user_id)
        filepath = os.path.join(AVATAR_DIR, filename)
        
        # Создаем директорию если не существует
        os.makedirs(AVATAR_DIR, exist_ok=True)
        
        # Сохраняем во временный файл сначала (для проверки что сохранение работает)
        temp_filepath = filepath + '.tmp'
        try:
            # Явно указываем формат (PNG для всех файлов для единообразия)
            img.save(temp_filepath, format='PNG', optimize=True)
        except Exception as e:
            # Если сохранение не удалось - НЕ удаляем старую аватарку
            if os.path.exists(temp_filepath):
                os.remove(temp_filepath)
            return False, f'Ошибка сохранения изображения: {str(e)}'
        
        # ✅ Только если сохранение успешно - удаляем старую аватарку
        delete_old_avatar(user_id)
        
        # Переименовываем временный файл в финальный
        if os.path.exists(filepath):
            os.remove(filepath)  # На случай если файл с таким расширением уже есть
        os.rename(temp_filepath, filepath)
        
        return True, filename
        
    except Exception as e:
        return False, f'Ошибка сохранения: {str(e)}'


def get_avatar_path(user_id: int) -> Optional[str]:
    """
    Возвращает путь к аватарке пользователя, если она существует.
    
    Args:
        user_id: ID пользователя
    
    Returns:
        Имя файла аватарки или None
    """
    filename = get_avatar_filename(user_id)
    filepath = os.path.join(AVATAR_DIR, filename)
    
    if os.path.exists(filepath):
        return filename
    
    return None

