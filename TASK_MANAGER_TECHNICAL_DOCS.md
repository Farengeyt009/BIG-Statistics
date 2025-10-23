# Task Manager - Техническая документация

## 📋 Оглавление
1. [Архитектура](#архитектура)
2. [База данных](#база-данных)
3. [Backend API](#backend-api)
4. [Frontend компоненты](#frontend-компоненты)
5. [Воркфлоу система](#воркфлоу-система)
6. [Система согласований](#система-согласований)
7. [Права доступа](#права-доступа)

---

## Архитектура

### Стек технологий
- **Backend:** Python 3.x, Flask
- **Database:** Microsoft SQL Server
- **Frontend:** React 18, TypeScript, Vite
- **UI:** Tailwind CSS, dnd-kit
- **State:** React Hooks (локальное состояние)

### Структура проекта
```
BIG_STATISTICS/
├── Back/
│   └── TaskManager/
│       ├── api/           # Flask blueprints
│       ├── service/       # Бизнес-логика
│       └── sql/           # SQL скрипты
└── Front/big-statistics-dashboard/
    └── src/pages/TaskManager/
        ├── components/    # React компоненты
        └── hooks/         # Custom hooks
```

---

## База данных

### Схема: Task_Manager

#### Основные таблицы:

**projects** - Проекты
```sql
- id (PK)
- name, description
- owner_id (FK → Users.users)
- has_workflow_permissions (BOOLEAN)
- default_assignee_id, default_subtask_assignee_id
- created_at, updated_at
```

**project_members** - Участники проектов
```sql
- id (PK)
- project_id (FK → projects, CASCADE)
- user_id (FK → Users.users)
- role (owner|admin|member|viewer)
- added_by, added_at
```

**tasks** - Задачи
```sql
- id (PK)
- project_id (FK → projects, CASCADE)
- parent_task_id (FK → tasks, NO ACTION)
- title, description
- status_id (FK → workflow_statuses)
- assignee_id, creator_id
- priority (low|medium|high|critical)
- due_date, completed_at
- order_index
- created_at, updated_at
```

**workflow_statuses** - Статусы воркфлоу
```sql
- id (PK)
- project_id (FK → projects, CASCADE)
- name, color
- is_initial, is_final, is_system
- order_index
```

**workflow_transitions** - Переходы между статусами
```sql
- id (PK)
- project_id (FK → projects, CASCADE)
- from_status_id, to_status_id
- name
- permission_type (any|roles|users)
- allowed_roles (JSON), allowed_users (JSON)
- is_bidirectional
- requires_attachment, requires_approvals
- required_approvals_count, required_approvers (JSON)
- auto_transition
```

**task_approvals** - Согласования
```sql
- id (PK)
- task_id (FK → tasks, CASCADE)
- user_id (FK → Users.users)
- approved_at, comment
- UNIQUE(task_id, user_id)
```

**custom_fields** - Кастомные поля
```sql
- id (PK)
- project_id (FK → projects, CASCADE)
- field_name, field_type (text|number|date|select|checkbox)
- field_options (JSON для select)
- is_required, is_active
- order_index
```

**custom_field_values** - Значения кастомных полей
```sql
- id (PK)
- task_id (FK → tasks, CASCADE)
- field_id (FK → custom_fields, NO ACTION - явное удаление в коде)
- value
```

**task_comments, task_attachments, tags, task_tags** - Комментарии, файлы, теги

---

## Backend API

### Endpoints структура

**Projects API** (`/api/task-manager/projects`)
- `GET /` - Список проектов пользователя
- `GET /:id` - Детали проекта
- `POST /` - Создать проект
- `PUT /:id` - Обновить проект
- `DELETE /:id` - Удалить проект
- `POST /:id/transfer-ownership` - Передать владельца
- `GET /:id/members` - Участники
- `POST /:id/members` - Добавить участника
- `DELETE /:id/members/:user_id` - Удалить участника

**Tasks API** (`/api/task-manager/tasks`)
- `GET /project/:id` - Задачи проекта (+ `?parent_task_id=X` для подзадач)
- `GET /:id` - Детали задачи
- `POST /` - Создать задачу (возвращает ID)
- `PUT /:id` - Обновить задачу
- `DELETE /:id` - Удалить задачу (+ подзадачи)

**Workflow API** (`/api/task-manager/workflow`)
- `GET /projects/:id/statuses` - Статусы проекта
- `POST /statuses` - Создать статус
- `PUT /statuses/:id` - Обновить статус
- `DELETE /statuses/:id` - Удалить (проверка на задачи + is_system)
- `GET /projects/:id/transitions` - Переходы
- `POST /transitions` - Создать переход
- `PUT /transitions/:id` - Обновить переход
- `DELETE /transitions/:id` - Удалить переход

**Custom Fields API** (`/api/task-manager/custom-fields`)
- `GET /project/:id` - Поля проекта
- `POST /` - Создать поле
- `PUT /:id` - Обновить поле
- `DELETE /:id` - Удалить поле
- `GET /task/:id/values` - Значения для задачи
- `POST /task/:id/values` - Установить значение

**Approvals API** (`/api/task-manager/approvals`)
- `GET /task/:id` - Согласования задачи
- `POST /task/:id` - Согласовать (+ автоперевод)
- `DELETE /task/:id` - Отозвать согласование

**Comments, Attachments, Tags** - стандартные CRUD

---

## Frontend компоненты

### Структура страниц

**TaskManagerPage** - Главная страница
- Переключатель таблица/карточки для проектов
- Роутинг между проектами и задачами

**ProjectsListPage** - Карточки проектов
**ProjectsTableView** - Таблица проектов (с прогресс-барами, health indicator)

**KanbanView** - Канбан доска
- DndContext для drag & drop
- Оптимистичные обновления только для status_id
- Сортировка, фильтры (скрытие завершенных)
- Priority/Status селекторы на карточках
- Toast уведомления для ошибок

**ListView** - Списочный вид
- Компактные строки
- Группировка по статусам
- Те же селекторы

**TaskDetailsModal** - Модалка задачи
- Двухколоночный layout (контент + свойства)
- 4 вкладки: Подзадачи, Комментарии, Файлы, Согласования
- Все вкладки монтируются сразу (display:none для скрытия → нет мерцания счетчиков)
- Валидация обязательных кастомных полей

**ProjectSettingsPage** - Настройки проекта
- 5 вкладок: Общее, Участники, Воркфлоу, Кастомные поля, Исполнители

### Ключевые hooks

**useTasks(projectId)**
```typescript
- tasks, statuses, loading, error
- fetchTasks() - загрузка
- createTask(data) → возвращает ID
- updateTask(id, updates) - оптимистичное для status_id
- deleteTask(id) - удаляет + подзадачи
```

**useWorkflow(projectId)**
- Управление статусами
- CRUD статусов с оптимистичным обновлением

**useTransitions(projectId)**
- Переходы воркфлоу
- Проверка двунаправленности

**useCustomFields(projectId)**
- Кастомные поля проекта

**useTaskFieldValues(taskId)**
- Значения полей для задачи

**useProjectMembers(projectId)**
- Участники + все пользователи системы

---

## Воркфлоу система

### Логика проверки перехода (tasks_service.py)

**При изменении status_id:**

1. **Проверка `has_workflow_permissions`**
   - Если FALSE → любой может переводить
   - Если TRUE → проверяем переход

2. **Поиск перехода:**
```python
WHERE project_id = ? AND (
    (from_status_id = old AND to_status_id = new) OR
    (from_status_id = new AND to_status_id = old AND is_bidirectional = 1)
)
```

3. **Проверка прав:**
   - `permission_type = 'any'` → все могут
   - `permission_type = 'roles'` → проверка роли в allowed_roles (JSON)
   - `permission_type = 'users'` → проверка user_id в allowed_users (JSON)

4. **Проверка условий:**
   - `requires_attachment` → COUNT(task_attachments) > 0
   - `requires_approvals` → проверка согласований (см. ниже)

5. **Установка completed_at:**
   - Если новый статус `is_final` → `completed_at = GETDATE()`
   - Если из final в обычный → `completed_at = NULL`

### Системные статусы

**Защищены от удаления (`is_system = 1`):**
- Новая (is_initial)
- В работе
- Завершена (is_final)
- Отменена (is_final)

---

## Система согласований

### Логика (для кейса Rework)

**Настройка перехода:**
```
"На согласовании" → "В работе"
- Требуются согласования: 3
- Кто может: [ОТК, Производство, Плановый отдел]
- Автоперевод: ✓
```

**Проверка при переносе:**
```python
if requires_approvals and required_approvals_count > 0:
    # Получаем согласования от разрешенных пользователей
    approved_from_pool = [u for u in approved_users if u in required_approvers]
    
    if len(approved_from_pool) < required_approvals_count:
        raise PermissionError("Требуется N согласований")
```

**Автоперевод (approvals_service.py → check_auto_transition):**

Вызывается после `add_approval`:
1. Ищет переходы с `auto_transition = 1` из текущего статуса
2. Проверяет ВСЕ условия (вложения, согласования)
3. Если выполнены → UPDATE tasks SET status_id

**Важно:** Вызывается в отдельном подключении ПОСЛЕ commit согласования

---

## Права доступа

### Роли в проекте

**Owner (владелец):**
- Все права
- Передача владельца
- Удаление проекта

**Admin (администратор):**
- Управление участниками
- Настройка воркфлоу
- Создание кастомных полей
- Создание/редактирование задач
- Удаление задач

**Member (участник):**
- Создание/редактирование задач
- Комментарии, файлы, подзадачи
- Согласования (если указан в списке)
- НЕ может удалять задачи

**Viewer (наблюдатель):**
- Только просмотр
- НЕ может создавать/редактировать

### Проверка прав в коде

**Backend (каждый метод):**
```python
role = check_project_access(project_id, user_id)
if not role:
    raise PermissionError("Нет доступа")

if role == 'viewer' and action == 'write':
    raise PermissionError("Viewer не может редактировать")
```

**Frontend:**
- Кнопки скрываются/disabled в зависимости от роли
- userRole загружается при открытии проекта

---

## Оптимизации

### Оптимистичные обновления

**Только для drag & drop статуса:**
```typescript
if (updates.status_id !== undefined && Object.keys(updates).length === 1) {
  // Мгновенно обновляем UI
  setTasks(prev => prev.map(t => t.id === taskId ? {...t, ...updates} : t));
}
// Потом запрос на сервер + fetchTasks через 500мс
```

**Для остальных полей:** сначала сервер, потом UI

### Воркфлоу - порядок статусов

**Обмен местами (swap):**
```typescript
await updateStatus(status1.id, { order_index: status2.order_index });
await updateStatus(status2.id, { order_index: status1.order_index });
// Параллельно без await → быстрее
```

### Файлы

**Структура хранения:**
```
uploads/task_attachments/
  ├── Название_проекта/
  │   └── uuid.расширение
```

**Логика:**
- Оригинальное имя (с кириллицей) → в БД
- UUID имя → на диске
- При загрузке: имя проекта очищается от недопустимых символов Windows

---

## Кастомные поля

### Типы полей

1. **text** - обычный input
2. **number** - number input
3. **date** - date picker
4. **select** - dropdown (field_options = JSON массив)
5. **checkbox** - boolean (значение "true"/"false")

### Сохранение

**При создании задачи:**
- createTask возвращает ID
- Цикл по customFieldValues
- POST для каждого поля

**При редактировании:**
- Изменения локально
- При "Сохранить" → POST для каждого измененного поля
- Валидация обязательных полей на фронте

---

## Особенности реализации

### Модалки - фиксированный размер

**Проблема:** При переключении вкладок модалка меняла размер

**Решение:**
```tsx
<div className="h-[85vh]">  // Фиксированная высота
  <div className="flex h-full overflow-hidden">
    <div className="flex-1 overflow-y-auto">  // Скролл контента
```

### Счетчики без мерцания

**Проблема:** При открытии вкладки счетчик: 0 → 2 → мерцание

**Решение:**
```tsx
// Все вкладки монтируются сразу
<div style={{ display: activeTab === 'comments' ? 'block' : 'none' }}>
  <CommentsSection onCountChange={setCommentCount} />
</div>

// Обновление только после загрузки
useEffect(() => {
  if (onCountChange && !loading) {
    onCountChange(comments.length);
  }
}, [comments.length, loading]);
```

### Аватары с fallback

**Компонент Avatar:**
```tsx
const [imageError, setImageError] = useState(false);

if (imageUrl && !imageError) {
  return <img onError={() => setImageError(true)} />
}
// Иначе инициалы с градиентом
```

### Toast уведомления

**При ошибках воркфлоу:**
- updateTask пробрасывает Error
- handleDragEnd catch → showToast(error.message, 'error')
- Toast автозакрывается через 4 сек

---

## Дальнейшие улучшения

### Архитектурные
1. **Zustand/Redux** - глобальное состояние (сейчас prop drilling)
2. **React Query** - кэширование API запросов
3. **Websockets** - реал-тайм обновления для команды

### Производительность
1. **Виртуализация** списков (react-window) при 1000+ задач
2. **Debounce** для автосохранения кастомных полей
3. **Batch API** - группировка запросов

### Безопасность
1. **Rate limiting** на Backend
2. **CSRF токены**
3. **Валидация** размера файлов (сейчас нет лимита)

---

## Запуск проекта

### Backend
```bash
cd Back
python Run_Server.py
# Сервер на http://localhost:5000
```

### Frontend
```bash
cd Front/big-statistics-dashboard
npm run dev
# Сервер на http://localhost:3000
```

### SQL скрипты (в порядке выполнения)
1. `create_tables.sql` - Основные таблицы
2. `custom_fields.sql` - Кастомные поля
3. `add_completed_at.sql` - Дата завершения
4. `add_default_assignees.sql` - Исполнители по умолчанию
5. `add_system_statuses.sql` - Защита системных статусов
6. `update_transitions_schema.sql` - permission_type, allowed_users
7. `add_bidirectional.sql` - Двунаправленные переходы
8. `add_transition_conditions.sql` - Условия (вложения, согласования)
9. `create_approvals.sql` - Таблица согласований
10. `add_auto_transition.sql` - Флаг автоперевода

---

## Troubleshooting

### "Задача не перемещается"
- Проверить `has_workflow_permissions` в проекте
- Включить в настройках "Проверка прав на переходы"
- Проверить логи Backend

### "Автоперевод не работает"
- Проверить `auto_transition = 1` в переходе
- Логи: `[AUTO]` в терминале Python
- Проверить выполнение всех условий

### "Мерцание счетчиков"
- Убедиться что вкладки используют `display: none` а не условный рендер

---

Автор: AI Assistant  
Дата: 23.10.2025  
Версия: 1.0

