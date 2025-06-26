#!/usr/bin/env python3
"""
Тестовый скрипт для проверки подключения к базе данных
"""

import os
from dotenv import load_dotenv
from database.db_connector import get_connection

def test_database_connection():
    """Тестирует подключение к базе данных"""
    
    print("=== Тест подключения к базе данных ===")
    
    # Загружаем переменные окружения
    load_dotenv()
    
    # Выводим настройки (без пароля)
    print(f"Сервер: {os.getenv('DB_HOST', 'не задан')}")
    print(f"Порт: {os.getenv('DB_PORT', 'не задан')}")
    print(f"База данных: {os.getenv('DB_NAME', 'не задана')}")
    print(f"Пользователь: {os.getenv('DB_USER', 'не задан')}")
    print(f"Пароль: {'*' * len(os.getenv('DB_PASSWORD', '')) if os.getenv('DB_PASSWORD') else 'не задан'}")
    
    try:
        # Пытаемся подключиться
        connection = get_connection()
        
        # Тестируем простой запрос
        cursor = connection.cursor()
        cursor.execute("SELECT @@VERSION")
        version = cursor.fetchone()
        
        print("\n✅ Подключение успешно!")
        print(f"Версия SQL Server: {version[0] if version else 'Неизвестно'}")
        
        # Закрываем соединение
        cursor.close()
        connection.close()
        
        return True
        
    except Exception as e:
        print(f"\n❌ Ошибка подключения: {e}")
        return False

if __name__ == "__main__":
    test_database_connection() 