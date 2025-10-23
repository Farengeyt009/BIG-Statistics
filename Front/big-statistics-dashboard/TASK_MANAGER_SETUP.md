# Task Manager - Frontend Setup

Инструкция по настройке Frontend для Task Manager.

## Установка библиотек

```bash
cd Front/big-statistics-dashboard

# Основные библиотеки для канбана
npm install react-trello
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# Для работы с датами
npm install date-fns

# Для загрузки файлов
npm install react-dropzone

# UUID для генерации уникальных ID
npm install uuid
npm install --save-dev @types/uuid
```

## Структура компонентов

```
src/pages/TaskManager/
├── ProjectsPage.tsx              # Список проектов с категориями
├── ProjectSettingsPage.tsx       # Настройки проекта
├── KanbanView.tsx               # Канбан доска (react-trello)
├── ListView.tsx                 # Табличный вид (AG Grid)
├── TaskDetailsModal.tsx         # Модальное окно задачи
├── StatisticsPage.tsx           # Статистика проектов
├── components/
│   ├── ProjectCard.tsx          # Карточка проекта
│   ├── TaskCard.tsx             # Карточка задачи
│   ├── WorkflowEditor.tsx       # Редактор воркфлоу
│   ├── TagManager.tsx           # Управление тегами
│   ├── CommentSection.tsx       # Секция комментариев
│   ├── FileUploader.tsx         # Загрузчик файлов
│   └── MemberManager.tsx        # Управление участниками
├── hooks/
│   ├── useProjects.ts           # Hook для работы с проектами
│   ├── useTasks.ts              # Hook для работы с задачами
│   └── useWorkflow.ts           # Hook для работы с воркфлоу
└── TaskManagerTranslation.json  # Переводы
```

## Пример использования react-trello

### 1. Базовый канбан

```tsx
import Board from 'react-trello';

interface KanbanViewProps {
  projectId: number;
}

export const KanbanView: React.FC<KanbanViewProps> = ({ projectId }) => {
  const [boardData, setBoardData] = useState({
    lanes: []
  });

  useEffect(() => {
    loadTasks();
  }, [projectId]);

  const loadTasks = async () => {
    // Получаем статусы
    const statusesRes = await fetch(
      `/api/task-manager/workflow/projects/${projectId}/statuses`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const { data: statuses } = await statusesRes.json();

    // Получаем задачи
    const tasksRes = await fetch(
      `/api/task-manager/tasks/project/${projectId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const { data: tasks } = await tasksRes.json();

    // Группируем задачи по статусам
    const lanes = statuses.map(status => ({
      id: status.id.toString(),
      title: status.name,
      label: `${tasks.filter(t => t.status_id === status.id).length}`,
      style: { backgroundColor: status.color + '20' },
      cards: tasks
        .filter(task => task.status_id === status.id)
        .map(task => ({
          id: task.id.toString(),
          title: task.title,
          description: task.description,
          label: task.priority,
          tags: task.tags?.map(t => ({ title: t.name, bgcolor: t.color })),
          metadata: task
        }))
    }));

    setBoardData({ lanes });
  };

  const handleCardMoveAcrossLanes = async (
    fromLaneId: string,
    toLaneId: string,
    cardId: string
  ) => {
    // Обновляем статус задачи
    await fetch(`/api/task-manager/tasks/${cardId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ status_id: parseInt(toLaneId) })
    });
  };

  return (
    <Board
      data={boardData}
      draggable
      editable
      onCardMoveAcrossLanes={handleCardMoveAcrossLanes}
      style={{ backgroundColor: '#f5f5f5', height: 'calc(100vh - 200px)' }}
    />
  );
};
```

### 2. Custom карточка задачи

```tsx
import { Card } from 'react-trello';

interface CustomTaskCardProps {
  task: any;
  onClick: () => void;
}

const CustomTaskCard: React.FC<CustomTaskCardProps> = ({ task, onClick }) => {
  const priorityColors = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444',
    critical: '#7c3aed'
  };

  return (
    <div
      onClick={onClick}
      className="bg-white p-4 rounded-lg shadow hover:shadow-md cursor-pointer"
    >
      {/* Заголовок */}
      <h3 className="font-semibold text-gray-800 mb-2">{task.title}</h3>

      {/* Описание */}
      {task.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Теги */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.tags.map((tag: any) => (
            <span
              key={tag.id}
              className="px-2 py-1 text-xs rounded"
              style={{ backgroundColor: tag.color + '40', color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Футер */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        {/* Приоритет */}
        <span
          className="px-2 py-1 rounded"
          style={{
            backgroundColor: priorityColors[task.priority] + '20',
            color: priorityColors[task.priority]
          }}
        >
          {task.priority}
        </span>

        {/* Исполнитель */}
        {task.assignee_name && (
          <span className="flex items-center gap-1">
            <UserIcon className="w-4 h-4" />
            {task.assignee_name}
          </span>
        )}

        {/* Дата */}
        {task.due_date && (
          <span className="flex items-center gap-1">
            <CalendarIcon className="w-4 h-4" />
            {format(new Date(task.due_date), 'dd.MM.yyyy')}
          </span>
        )}
      </div>

      {/* Счетчики */}
      <div className="flex gap-3 mt-2 text-xs text-gray-500">
        {task.subtask_count > 0 && (
          <span>📋 {task.subtask_count}</span>
        )}
        {task.comment_count > 0 && (
          <span>💬 {task.comment_count}</span>
        )}
        {task.attachment_count > 0 && (
          <span>📎 {task.attachment_count}</span>
        )}
      </div>
    </div>
  );
};
```

### 3. Hook для работы с задачами

```tsx
// hooks/useTasks.ts
import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export const useTasks = (projectId: number) => {
  const { token } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/task-manager/tasks/project/${projectId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const { data } = await response.json();
      setTasks(data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, token]);

  const createTask = useCallback(async (taskData: any) => {
    try {
      const response = await fetch('/api/task-manager/tasks/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...taskData, project_id: projectId })
      });
      
      if (response.ok) {
        await fetchTasks();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error creating task:', error);
      return false;
    }
  }, [projectId, token, fetchTasks]);

  const updateTask = useCallback(async (taskId: number, updates: any) => {
    try {
      const response = await fetch(`/api/task-manager/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      
      if (response.ok) {
        await fetchTasks();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating task:', error);
      return false;
    }
  }, [token, fetchTasks]);

  const deleteTask = useCallback(async (taskId: number) => {
    try {
      const response = await fetch(`/api/task-manager/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        await fetchTasks();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting task:', error);
      return false;
    }
  }, [token, fetchTasks]);

  return {
    tasks,
    loading,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask
  };
};
```

### 4. AG Grid для табличного вида

```tsx
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

export const ListView: React.FC<{ projectId: number }> = ({ projectId }) => {
  const { tasks, loading } = useTasks(projectId);

  const columnDefs = [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'title', headerName: 'Название', flex: 1 },
    { field: 'status_name', headerName: 'Статус', width: 150 },
    { field: 'assignee_name', headerName: 'Исполнитель', width: 150 },
    { 
      field: 'priority', 
      headerName: 'Приоритет',
      width: 120,
      cellStyle: params => {
        const colors = {
          low: { backgroundColor: '#d1fae5' },
          medium: { backgroundColor: '#fef3c7' },
          high: { backgroundColor: '#fee2e2' },
          critical: { backgroundColor: '#ede9fe' }
        };
        return colors[params.value] || {};
      }
    },
    { 
      field: 'due_date', 
      headerName: 'Срок',
      width: 120,
      valueFormatter: params => 
        params.value ? format(new Date(params.value), 'dd.MM.yyyy') : ''
    }
  ];

  return (
    <div className="ag-theme-alpine" style={{ height: 600, width: '100%' }}>
      <AgGridReact
        rowData={tasks}
        columnDefs={columnDefs}
        defaultColDef={{
          sortable: true,
          filter: true,
          resizable: true
        }}
        pagination
        paginationPageSize={50}
        loading={loading}
      />
    </div>
  );
};
```

## Роутинг

Добавьте в `App.tsx`:

```tsx
import { TaskManagerRoutes } from './pages/TaskManager/TaskManagerRoutes';

// В компоненте App
<Route path="/task-manager/*" element={<TaskManagerRoutes />} />
```

Создайте `TaskManagerRoutes.tsx`:

```tsx
import { Routes, Route } from 'react-router-dom';
import { ProjectsPage } from './ProjectsPage';
import { KanbanView } from './KanbanView';
import { ListView } from './ListView';
import { ProjectSettingsPage } from './ProjectSettingsPage';

export const TaskManagerRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<ProjectsPage />} />
      <Route path="/project/:projectId/kanban" element={<KanbanView />} />
      <Route path="/project/:projectId/list" element={<ListView />} />
      <Route path="/project/:projectId/settings" element={<ProjectSettingsPage />} />
    </Routes>
  );
};
```

## Следующие шаги

1. Установите библиотеки
2. Создайте базовую структуру компонентов
3. Реализуйте канбан с `react-trello`
4. Добавьте табличный вид с AG Grid
5. Реализуйте модальное окно задачи с комментариями и вложениями
6. Добавьте статистику с recharts

## Полезные ссылки

- [react-trello документация](https://github.com/rcdexta/react-trello)
- [AG Grid React](https://www.ag-grid.com/react-data-grid/)
- [Recharts](https://recharts.org/)

