import React, { useState, useMemo } from 'react';
import { useTasks } from './hooks/useTasks';
import { TaskDetailsModal } from './components/TaskDetailsModal';
import { PrioritySelector } from './components/PrioritySelector';
import { StatusSelector } from './components/StatusSelector';
import { SortSelector, SortOption } from './components/SortSelector';
import { Avatar } from './components/ui/Avatar';
import { format } from 'date-fns';

interface ListViewProps {
  projectId: number;
}

const priorityColors: Record<string, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#7c3aed',
};

const priorityOrder: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const ListView: React.FC<ListViewProps> = ({ projectId }) => {
  const { tasks, statuses, loading, updateTask, deleteTask, fetchTasks } = useTasks(projectId);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [sortBy, setSortBy] = useState<SortOption>('priority');
  const [hideCompleted, setHideCompleted] = useState(false);

  // Сортировка задач
  const sortTasks = (tasksToSort: any[]) => {
    return [...tasksToSort].sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'updated':
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'title':
          return a.title.localeCompare(b.title);
        case 'dueDate':
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        default:
          return 0;
      }
    });
  };

  // Группируем задачи по статусам с сортировкой и скрытием завершенных
  const tasksByStatus = useMemo(() => {
    return statuses
      .filter((status) => !hideCompleted || !status.is_final) // Скрываем финальные статусы если включено
      .map((status) => {
        const filteredTasks = tasks.filter((t) => t.status_id === status.id);
        return {
          status,
          tasks: sortTasks(filteredTasks),
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, statuses, sortBy, hideCompleted]);

  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Панель управления */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-600">
            Всего задач: <span className="font-medium text-gray-900">{tasks.length}</span>
          </div>
          <button
            onClick={() => setHideCompleted(!hideCompleted)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              hideCompleted
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            title={hideCompleted ? 'Показать завершенные' : 'Скрыть завершенные'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {hideCompleted ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              )}
            </svg>
            {hideCompleted ? 'Показать' : 'Скрыть'}
          </button>
        </div>
        <SortSelector value={sortBy} onChange={setSortBy} />
      </div>

      {/* Список задач */}
      <div className="flex-1 overflow-y-auto">
        {tasksByStatus.map(({ status, tasks: statusTasks }) => (
          <div key={status.id} className="mb-0">
            {/* Заголовок группы */}
            <div
              className="sticky top-0 z-10 h-10 flex items-center px-6 border-b border-gray-100"
              style={{ backgroundColor: `${status.color}08` }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: status.color }}
                />
                <span className="text-sm font-medium text-gray-900">{status.name}</span>
                <span className="text-sm text-gray-500">{statusTasks.length}</span>
              </div>
            </div>

            {/* Список задач статуса */}
            <div className="divide-y divide-gray-100">
              {statusTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className="flex items-center h-11 px-6 hover:bg-gray-50 cursor-pointer transition-colors group"
                >
                  {/* Приоритет и ID */}
                  <div className="flex items-center gap-1">
                    <PrioritySelector
                      priority={task.priority}
                      taskId={task.id}
                      onUpdate={(priority) => updateTask(task.id, { priority })}
                    />
                    <span className="text-sm text-gray-500 font-medium w-16 shrink-0">
                      #{task.id}
                    </span>
                    <StatusSelector
                      status={{
                        id: task.status_id,
                        name: task.status_name,
                        color: task.status_color,
                      }}
                      statuses={statuses}
                      taskId={task.id}
                      onUpdate={(statusId) => updateTask(task.id, { status_id: statusId })}
                    />
                  </div>

                  {/* Название */}
                  <span className="flex-1 text-sm font-medium text-gray-900 truncate ml-2">
                    {task.title}
                  </span>

                  {/* Метаданные справа */}
                  <div className="flex items-center gap-3 ml-auto">
                    {/* Теги */}
                    {task.tags && task.tags.length > 0 && (
                      <div className="flex gap-1">
                        {task.tags.slice(0, 2).map((tag: any) => (
                          <span
                            key={tag.id}
                            className="text-xs px-2 py-0.5 rounded font-medium"
                            style={{
                              backgroundColor: `${tag.color}15`,
                              color: tag.color,
                            }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Дата */}
                    <span className="text-xs text-gray-500 w-16 text-right">
                      {task.created_at ? format(new Date(task.created_at), 'MMM dd') : ''}
                    </span>

                    {/* Исполнитель */}
                    {task.assignee_id && task.assignee_name && (
                      <Avatar
                        name={task.assignee_name}
                        imageUrl={`/avatar_${task.assignee_id}.png`}
                        size="sm"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Модальное окно задачи */}
      {selectedTask && (
        <TaskDetailsModal
          task={selectedTask}
          statuses={statuses}
          onClose={() => setSelectedTask(null)}
          onUpdate={async (updates) => {
            await updateTask(selectedTask.id, updates);
            // fetchTasks уже вызывается внутри updateTask
            setSelectedTask(null);
          }}
          onDelete={async () => {
            await deleteTask(selectedTask.id);
            setSelectedTask(null);
          }}
        />
      )}
    </div>
  );
};

