# Run_Server.py

from BIG_STATISTICS import create_app

# Создаем приложение
app = create_app()

if __name__ == '__main__':
    print("Запуск сервера BIG_STATISTICS...")
    print("Сервер будет доступен по адресу: http://127.0.0.1:5000/")
    app.run(debug=True, host='127.0.0.1', port=5000)
