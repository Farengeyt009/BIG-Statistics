# Task Manager - Backend

Полнофункциональный таск-менеджер с настройкой прав, воркфлоу, тегами, комментариями и вложениями.

## Структура

```
TaskManager/
├── api/
│   ├── projects_api.py            # API проектов и категорий
│   ├── tasks_api.py               # API задач
│   ├── workflow_api.py            # API воркфлоу (статусы и переходы)
│   ├── tags_api.py                # API тегов
│   ├── comments_api.py            # API комментариев
│   └── attachments_api.py         # API вложений
└── service/
    ├── projects_service.py        # Бизнес-логика проектов
    ├── tasks_service.py           # Бизнес-логика задач
    ├── workflow_service.py        # Бизнес-логика воркфлоу
    ├── tags_service.py            # Бизнес-логика тегов
    ├── comments_service.py        # Бизнес-логика комментариев
    └── attachments_service.py     # Бизнес-логика вложений
```

## Установка

### 1. База данных

Task Manager работает с уже существующей схемой `Task_Manager` в MSSQL.
SQL-скрипты и миграции в этом модуле удалены из репозитория и больше не используются в текущем процессе.

### 2. Регистрация API (уже выполнено)

API endpoints уже зарегистрированы в `Back/Run_Server.py`.

### 3. Создание директории для загрузок

Директория `uploads/task_attachments` будет создана автоматически при первой загрузке файла.

## API Endpoints

### Проекты

#### GET `/api/task-manager/projects/`
Получить все проекты текущего пользователя

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Проект 1",
      "description": "Описание",
      "category_id": 1,
      "category_name": "Разработка",
      "owner_id": 1,
      "owner_name": "admin",
      "user_role": "owner",
      "has_workflow_permissions": false,
      "task_count": 5,
      "member_count": 3
    }
  ]
}
```

#### POST `/api/task-manager/projects/`
Создать новый проект

**Body:**
```json
{
  "name": "Новый проект",
  "description": "Описание проекта",
  "category_id": 1,
  "has_workflow_permissions": false
}
```

#### PUT `/api/task-manager/projects/<project_id>`
Обновить проект (только owner)

#### DELETE `/api/task-manager/projects/<project_id>`
Удалить проект (только owner)

### Категории

#### GET `/api/task-manager/projects/categories/all`
Получить все категории

#### POST `/api/task-manager/projects/categories`
Создать категорию

**Body:**
```json
{
  "name": "Разработка",
  "description": "Проекты разработки",
  "icon": "code",
  "color": "#3b82f6"
}
```

### Участники проекта

#### GET `/api/task-manager/projects/<project_id>/members`
Получить участников проекта

#### POST `/api/task-manager/projects/<project_id>/members`
Добавить участника

**Body:**
```json
{
  "user_id": 2,
  "role": "member"
}
```

Роли: `owner`, `admin`, `member`, `viewer`

### Задачи

#### GET `/api/task-manager/tasks/project/<project_id>`
Получить задачи проекта

**Query Parameters:**
- `parent_task_id` (опционально) - для получения подзадач

#### POST `/api/task-manager/tasks/`
Создать задачу

**Body:**
```json
{
  "project_id": 1,
  "title": "Название задачи",
  "description": "Описание",
  "status_id": 1,
  "assignee_id": 2,
  "priority": "high",
  "due_date": "2025-12-31",
  "parent_task_id": null,
  "tag_ids": [1, 2]
}
```

Приоритеты: `low`, `medium`, `high`, `critical`

#### PUT `/api/task-manager/tasks/<task_id>`
Обновить задачу

#### DELETE `/api/task-manager/tasks/<task_id>`
Удалить задачу (только owner или admin)

### Воркфлоу

#### GET `/api/task-manager/workflow/projects/<project_id>/statuses`
Получить статусы проекта

#### POST `/api/task-manager/workflow/statuses`
Создать статус (только owner или admin)

**Body:**
```json
{
  "project_id": 1,
  "name": "В работе",
  "color": "#3b82f6",
  "order_index": 1,
  "is_initial": false,
  "is_final": false
}
```

#### GET `/api/task-manager/workflow/projects/<project_id>/transitions`
Получить переходы воркфлоу

#### POST `/api/task-manager/workflow/transitions`
Создать переход (только owner или admin)

**Body:**
```json
{
  "project_id": 1,
  "from_status_id": 1,
  "to_status_id": 2,
  "name": "Взять в работу",
  "allowed_roles": ["owner", "admin", "member"]
}
```

### Теги

#### GET `/api/task-manager/tags/project/<project_id>`
Получить теги проекта

#### POST `/api/task-manager/tags/`
Создать тег

**Body:**
```json
{
  "project_id": 1,
  "name": "Срочно",
  "color": "#ef4444"
}
```

### Комментарии

#### GET `/api/task-manager/comments/task/<task_id>`
Получить комментарии задачи

#### POST `/api/task-manager/comments/`
Добавить комментарий

**Body:**
```json
{
  "task_id": 1,
  "comment": "Текст комментария"
}
```

### Вложения

#### GET `/api/task-manager/attachments/task/<task_id>`
Получить вложения задачи

#### POST `/api/task-manager/attachments/task/<task_id>`
Загрузить файл

**Content-Type:** `multipart/form-data`

**Form Data:**
```
file: <binary file>
```

#### GET `/api/task-manager/attachments/<attachment_id>/download`
Скачать файл

#### DELETE `/api/task-manager/attachments/<attachment_id>`
Удалить файл

## Система прав

### Роли в проекте:
- **owner** - владелец проекта (все права)
- **admin** - администратор (управление участниками, воркфлоу)
- **member** - участник (создание/редактирование задач)
- **viewer** - наблюдатель (только просмотр)

### Права на действия:

| Действие | Owner | Admin | Member | Viewer |
|----------|-------|-------|--------|--------|
| Редактировать проект | ✅ | ❌ | ❌ | ❌ |
| Удалить проект | ✅ | ❌ | ❌ | ❌ |
| Управлять участниками | ✅ | ✅ | ❌ | ❌ |
| Настраивать воркфлоу | ✅ | ✅ | ❌ | ❌ |
| Создавать задачи | ✅ | ✅ | ✅ | ❌ |
| Редактировать задачи | ✅ | ✅ | ✅ | ❌ |
| Удалять задачи | ✅ | ✅ | ❌ | ❌ |
| Комментировать | ✅ | ✅ | ✅ | ❌ |
| Загружать файлы | ✅ | ✅ | ✅ | ❌ |
| Просмотр | ✅ | ✅ | ✅ | ✅ |

## Тестирование

### 1. Создание тестового проекта

```bash
curl -X POST http://localhost:5000/api/task-manager/projects/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Тестовый проект",
    "description": "Проект для тестирования"
  }'
```

### 2. Получение списка проектов

```bash
curl -X GET http://localhost:5000/api/task-manager/projects/ \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Создание задачи

```bash
curl -X POST http://localhost:5000/api/task-manager/tasks/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": 1,
    "title": "Тестовая задача",
    "priority": "high"
  }'
```

## Следующие шаги

1. ✅ Backend готов
2. 🔄 Frontend нужно создать:
   - Установить `react-trello` для канбана
   - Создать страницы для проектов, задач
   - Настроить AG Grid для режима списка
   - Добавить recharts для статистики

## Дополнительно

### История изменений

Таблица `task_history` готова для логирования всех изменений задач. Можно добавить API endpoint для просмотра истории.

### Уведомления

Структура готова для добавления уведомлений. Можно добавить:
- Email уведомления
- WebSocket для real-time уведомлений
- Таблицу `notifications` в БД

