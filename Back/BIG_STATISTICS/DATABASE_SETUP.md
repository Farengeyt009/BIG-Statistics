# Настройка подключения к базе данных

## Проблемы и решения

### 1. SQL Server не запущен
**Симптом**: `Сервер не найден или недоступен`

**Решение**:
1. Откройте **SQL Server Configuration Manager**
2. Убедитесь, что служба **SQL Server (MSSQLSERVER)** запущена
3. Или запустите через командную строку:
   ```cmd
   net start MSSQLSERVER
   ```

### 2. Неправильный порт или экземпляр
**Симптом**: `Не удалось открыть соединение с SQL Server`

**Варианты подключения**:
- **По умолчанию**: `localhost` или `localhost:1433`
- **Именованный экземпляр**: `localhost\SQLEXPRESS` или `localhost\SQLEXPRESS,1433`
- **Кастомный порт**: `localhost:14330`

### 3. ODBC Driver не установлен
**Симптом**: `Data source name not found, and no default driver specified`

**Решение**:
1. Скачайте **Microsoft ODBC Driver 18 for SQL Server**:
   https://docs.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server
2. Или используйте **ODBC Driver 17** (измените в config.py)

### 4. Проблемы с аутентификацией
**Симптом**: `Login failed for user`

**Решение**:
1. Включите **SQL Server and Windows Authentication mode**
2. Создайте пользователя SQL Server
3. Или используйте **Windows Authentication**

## Настройка файла .env

Отредактируйте файл `.env` в папке `Back/BIG_STATISTICS/`:

```env
# База данных
DB_HOST=localhost
DB_PORT=1433
DB_NAME=your_database_name
DB_USER=your_username
DB_PASSWORD=your_password

# Альтернативные варианты:
# DB_HOST=localhost\SQLEXPRESS
# DB_HOST=192.168.1.100
# DB_PORT=14330
```

## Тестирование подключения

### 1. Проверка SQL Server
```cmd
sqlcmd -S localhost -E
# или
sqlcmd -S localhost\SQLEXPRESS -E
```

### 2. Тест через Python
```bash
python test_db_connection.py
```

### 3. Проверка драйверов ODBC
```python
import pyodbc
print(pyodbc.drivers())
```

## Альтернативные строки подключения

### Windows Authentication
```python
conn_str = (
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=localhost;"
    "DATABASE=your_database;"
    "Trusted_Connection=yes;"
    "Encrypt=no;"
    "TrustServerCertificate=yes;"
)
```

### SQL Server Express
```python
conn_str = (
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=localhost\\SQLEXPRESS;"
    "DATABASE=your_database;"
    "UID=your_username;"
    "PWD=your_password;"
    "Encrypt=no;"
    "TrustServerCertificate=yes;"
)
```

### Удаленный сервер
```python
conn_str = (
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=192.168.1.100,1433;"
    "DATABASE=your_database;"
    "UID=your_username;"
    "PWD=your_password;"
    "Encrypt=no;"
    "TrustServerCertificate=yes;"
)
```

## Пошаговая настройка

### Шаг 1: Проверьте SQL Server
1. Откройте **SQL Server Management Studio**
2. Подключитесь к серверу
3. Убедитесь, что база данных существует

### Шаг 2: Настройте пользователя
```sql
-- Создайте пользователя
CREATE LOGIN your_username WITH PASSWORD = 'your_password';
CREATE USER your_username FOR LOGIN your_username;

-- Дайте права
GRANT CONNECT TO your_username;
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO your_username;
```

### Шаг 3: Обновите .env файл
```env
DB_HOST=localhost
DB_PORT=1433
DB_NAME=your_database_name
DB_USER=your_username
DB_PASSWORD=your_password
```

### Шаг 4: Протестируйте
```bash
python test_db_connection.py
```

## Устранение неполадок

### Ошибка: "Login failed for user"
- Проверьте правильность логина/пароля
- Убедитесь, что пользователь существует
- Проверьте права доступа

### Ошибка: "Server not found"
- Проверьте, что SQL Server запущен
- Убедитесь в правильности имени сервера
- Проверьте настройки брандмауэра

### Ошибка: "Driver not found"
- Установите ODBC Driver 18
- Или измените на ODBC Driver 17 в config.py

### Ошибка: "Encryption not supported"
- Добавьте `Encrypt=no` в строку подключения
- Или настройте SSL сертификат на сервере 