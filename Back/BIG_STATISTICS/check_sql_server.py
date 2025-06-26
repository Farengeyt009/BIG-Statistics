#!/usr/bin/env python3
"""
Скрипт для проверки статуса SQL Server
"""

import subprocess
import socket
import os

def check_sql_server_status():
    """Проверяет статус SQL Server"""
    
    print("=== Проверка SQL Server ===")
    
    # Проверка службы SQL Server
    try:
        result = subprocess.run(
            ['sc', 'query', 'MSSQLSERVER'], 
            capture_output=True, 
            text=True, 
            shell=True
        )
        
        if 'RUNNING' in result.stdout:
            print("✅ Служба SQL Server (MSSQLSERVER) запущена")
        else:
            print("❌ Служба SQL Server (MSSQLSERVER) не запущена")
            print("Попробуйте запустить: net start MSSQLSERVER")
            
    except Exception as e:
        print(f"❌ Ошибка проверки службы: {e}")
    
    # Проверка службы SQL Server Express
    try:
        result = subprocess.run(
            ['sc', 'query', 'MSSQL$SQLEXPRESS'], 
            capture_output=True, 
            text=True, 
            shell=True
        )
        
        if 'RUNNING' in result.stdout:
            print("✅ Служба SQL Server Express запущена")
        else:
            print("ℹ️  Служба SQL Server Express не запущена")
            
    except Exception as e:
        print(f"ℹ️  SQL Server Express не установлен или недоступен")
    
    # Проверка порта 1433
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        result = sock.connect_ex(('localhost', 1433))
        sock.close()
        
        if result == 0:
            print("✅ Порт 1433 открыт (SQL Server слушает)")
        else:
            print("❌ Порт 1433 закрыт (SQL Server не слушает)")
            
    except Exception as e:
        print(f"❌ Ошибка проверки порта: {e}")
    
    # Проверка доступности через sqlcmd
    try:
        result = subprocess.run(
            ['sqlcmd', '-S', 'localhost', '-E', '-Q', 'SELECT @@VERSION'],
            capture_output=True, 
            text=True, 
            timeout=10
        )
        
        if result.returncode == 0:
            print("✅ SQL Server доступен через sqlcmd")
            print(f"Версия: {result.stdout.strip()}")
        else:
            print("❌ SQL Server недоступен через sqlcmd")
            
    except FileNotFoundError:
        print("ℹ️  sqlcmd не найден (установите SQL Server Command Line Utilities)")
    except subprocess.TimeoutExpired:
        print("❌ Таймаут подключения к SQL Server")
    except Exception as e:
        print(f"❌ Ошибка sqlcmd: {e}")

def suggest_solutions():
    """Предлагает решения проблем"""
    
    print("\n=== Рекомендации ===")
    print("1. Запустите SQL Server:")
    print("   - Откройте SQL Server Configuration Manager")
    print("   - Запустите службу SQL Server (MSSQLSERVER)")
    print("   - Или выполните: net start MSSQLSERVER")
    
    print("\n2. Проверьте настройки:")
    print("   - Включите TCP/IP в SQL Server Configuration Manager")
    print("   - Убедитесь, что порт 1433 открыт")
    print("   - Проверьте настройки брандмауэра")
    
    print("\n3. Альтернативные варианты подключения:")
    print("   - localhost\\SQLEXPRESS (для SQL Server Express)")
    print("   - localhost,1433 (явное указание порта)")
    print("   - 127.0.0.1 (IP вместо localhost)")
    
    print("\n4. Установите SQL Server:")
    print("   - Скачайте SQL Server Express: https://www.microsoft.com/sql-server/sql-server-downloads")
    print("   - Или SQL Server Developer Edition")

if __name__ == "__main__":
    check_sql_server_status()
    suggest_solutions() 