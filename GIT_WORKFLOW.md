# Git Workflow для BIG_STATISTICS

## Структура веток

- **`master`** - стабильная версия проекта
- **`develop`** - версия в разработке
- **`feature/*`** - ветки для новых функций
- **`hotfix/*`** - срочные исправления

## Основные команды

### Просмотр статуса
```bash
git status                    # Статус изменений
git log --oneline            # История коммитов
git branch                   # Список веток
```

### Работа с изменениями
```bash
git add .                    # Добавить все изменения
git add filename             # Добавить конкретный файл
git commit -m "Описание"     # Создать коммит
git push                     # Отправить изменения в GitHub
git pull                     # Скачать изменения с GitHub
```

### Работа с ветками
```bash
git checkout master          # Переключиться на master
git checkout develop         # Переключиться на develop
git checkout -b feature/new-feature  # Создать новую ветку
git merge feature/new-feature        # Слить ветку в текущую
```

## Типичный рабочий процесс

### 1. Начало работы над новой функцией
```bash
git checkout develop         # Переключиться на develop
git pull                     # Получить последние изменения
git checkout -b feature/my-new-feature  # Создать ветку для функции
```

### 2. Разработка
```bash
# Вносите изменения в код
git add .                    # Добавить изменения
git commit -m "feat: добавлена новая функция"
git push origin feature/my-new-feature  # Отправить ветку в GitHub
```

### 3. Завершение работы
```bash
git checkout develop         # Переключиться на develop
git merge feature/my-new-feature  # Слить функцию в develop
git push origin develop      # Отправить develop в GitHub
git branch -d feature/my-new-feature  # Удалить локальную ветку
```

## Откат к предыдущим версиям

### Просмотр истории
```bash
git log --oneline            # Показать историю коммитов
git show <commit-hash>       # Показать изменения в коммите
```

### Временный откат
```bash
git checkout <commit-hash>   # Переключиться на конкретный коммит
git checkout develop         # Вернуться к develop
```

### Постоянный откат
```bash
git revert <commit-hash>     # Создать новый коммит, отменяющий изменения
git reset --hard <commit-hash>  # Удалить все изменения после коммита
```

### Откат конкретного файла
```bash
git checkout <commit-hash> -- filename  # Откатить конкретный файл
```

## Сообщения коммитов

Используйте понятные сообщения:
```
feat: добавлена новая таблица статистики
fix: исправлена ошибка в API
docs: обновлена документация
refactor: переработан код компонента
test: добавлены тесты
style: исправлено форматирование
```

## Безопасность

### Что НЕ попадает в Git:
- Файлы `.env` с паролями
- Виртуальная среда `.venv/`
- Временные файлы
- Логи и базы данных

### Что попадает в Git:
- Исходный код
- Конфигурационные файлы (без секретов)
- Документация
- Примеры конфигурации

## Полезные команды

### Просмотр изменений
```bash
git diff                     # Изменения в рабочей директории
git diff --staged           # Изменения в staging area
git diff HEAD~1             # Изменения в последнем коммите
```

### Очистка
```bash
git clean -n                # Показать файлы для удаления
git clean -f                # Удалить неотслеживаемые файлы
git reset --hard HEAD       # Отменить все изменения
```

### Информация
```bash
git remote -v               # Показать удаленные репозитории
git branch -a               # Показать все ветки (локальные и удаленные)
git status --short          # Краткий статус
```

## Примеры сценариев

### Сценарий 1: Добавление новой функции
```bash
git checkout develop
git pull
git checkout -b feature/user-authentication
# Разработка...
git add .
git commit -m "feat: добавлена система аутентификации"
git push origin feature/user-authentication
# Создать Pull Request на GitHub
```

### Сценарий 2: Исправление бага
```bash
git checkout develop
git pull
git checkout -b hotfix/critical-bug-fix
# Исправление...
git add .
git commit -m "fix: исправлен критический баг в API"
git push origin hotfix/critical-bug-fix
```

### Сценарий 3: Откат к стабильной версии
```bash
git log --oneline           # Найти нужный коммит
git checkout <stable-commit-hash>
# Проверить работу
git checkout develop        # Вернуться к разработке
``` 