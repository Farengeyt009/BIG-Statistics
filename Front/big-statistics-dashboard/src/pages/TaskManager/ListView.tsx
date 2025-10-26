import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTasks } from './hooks/useTasks';
import { useStatusTranslation } from './hooks/useStatusTranslation';
import { TaskDetailsModal } from './components/TaskDetailsModal';
import { PrioritySelector } from './components/PrioritySelector';
import { StatusSelector } from './components/StatusSelector';
import { SortSelector, SortOption } from './components/SortSelector';
import { Avatar } from './components/ui/Avatar';
import { format } from 'date-fns';
import TaskManagerTranslation from './TaskManagerTranslation.json';

interface ListViewProps {
  projectId: number;
  onBackToProjects?: () => void;
  onOpenSettings?: () => void;
  viewType?: 'list' | 'grid' | 'attachments';
  onViewTypeChange?: (viewType: 'list' | 'grid' | 'attachments') => void;
  refreshKey?: number;
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

export const ListView: React.FC<ListViewProps> = ({ 
  projectId, 
  onBackToProjects, 
  onOpenSettings, 
  viewType, 
  onViewTypeChange,
  refreshKey 
}) => {
  const { t, i18n } = useTranslation('taskManager');
  const { translateStatus } = useStatusTranslation();
  const { tasks, statuses, loading, updateTask, deleteTask, fetchTasks, fetchStatuses } = useTasks(projectId);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [collapsedStatuses, setCollapsedStatuses] = useState<Set<number>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>('priority');
  const [hideCompleted, setHideCompleted] = useState(false);

  // Load translations for Task Manager
  React.useEffect(() => {
    const currentLang = i18n.language;
    if (TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(currentLang, 'taskManager', TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);

  // Функция для переключения сворачивания группы
  const toggleStatusCollapse = (statusId: number) => {
    setCollapsedStatuses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(statusId)) {
        newSet.delete(statusId);
      } else {
        newSet.add(statusId);
      }
      return newSet;
    });
  };

  // Получаем дополнительные поля проекта
  const fetchCustomFields = React.useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/task-manager/custom-fields/project/${projectId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setCustomFields(data.data.slice(0, 6)); // Берем только первые 6 полей
      }
    } catch (err) {
      console.error('Ошибка загрузки полей:', err);
    }
  }, [projectId]);

  // Обновляем статусы при изменении refreshKey
  React.useEffect(() => {
    if (refreshKey && refreshKey > 0) {
      fetchStatuses();
    }
  }, [refreshKey, fetchStatuses]);

  // Загружаем поля при монтировании и изменении refreshKey
  React.useEffect(() => {
    fetchCustomFields();
  }, [fetchCustomFields, refreshKey]);

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
        <div className="text-gray-500">{t('listViewLoading')}</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Панель управления */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3">
          {onBackToProjects && (
            <button
              onClick={onBackToProjects}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t('back')}
            </button>
          )}
          
          {viewType && onViewTypeChange && (
            <div className="inline-flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => onViewTypeChange('list')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewType === 'list'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <button
                onClick={() => onViewTypeChange('grid')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewType === 'grid'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
              </button>
              <button
                onClick={() => onViewTypeChange('attachments')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewType === 'attachments'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <SortSelector value={sortBy} onChange={setSortBy} />
          <button
            onClick={() => setHideCompleted(!hideCompleted)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              hideCompleted
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            title={hideCompleted ? t('showCompleted') : t('hideCompleted')}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {hideCompleted ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              )}
            </svg>
          </button>
          
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              title={t('projectSettings')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Список задач */}
      <div className="flex-1 overflow-y-auto">
        {/* Общая шапка для всех строк */}
        <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
          <div className="px-6 py-3">
            <div className="flex items-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="w-[10%]">{t('listViewStatus')}</div>
              <div className="w-[5%]"></div>
              <div className="w-[15%]">{t('listViewTask')}</div>
              <div className="w-[10%]">{t('listViewCreatedDate')}</div>
              {customFields.map((field, index) => (
                <div key={field.id} className="w-[10%]">
                  {field.field_name}
                </div>
              ))}
              <div className="w-[10%]">{t('listViewAssignee')}</div>
            </div>
          </div>
        </div>

        {tasksByStatus.map(({ status, tasks: statusTasks }) => (
          <div key={status.id} className="mb-6">
            {/* Заголовок группы */}
            <div
              className="sticky top-12 z-10 h-10 flex items-center px-6 border-b border-gray-100 cursor-pointer hover:bg-opacity-20 transition-colors"
              style={{ backgroundColor: `${status.color}08` }}
              onClick={() => toggleStatusCollapse(status.id)}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-4 h-4 flex items-center justify-center transition-transform duration-200 ${
                    collapsedStatuses.has(status.id) ? 'rotate-0' : 'rotate-90'
                  }`}
                >
                  <svg
                    className="w-3 h-3 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: status.color }}
                />
                <span className="text-sm font-medium text-gray-900">{translateStatus(status)}</span>
                <span className="text-sm text-gray-500">{statusTasks.length}</span>
              </div>
            </div>

            {/* Список задач статуса */}
            {!collapsedStatuses.has(status.id) && (
              <div className="divide-y divide-gray-100">
                {statusTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className="flex items-center h-11 px-6 hover:bg-gray-50 cursor-pointer transition-colors group"
                >
                  {/* Статус */}
                  <div className="w-[10%]">
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

                  {/* Приоритет */}
                  <div className="w-[5%]">
                    <PrioritySelector
                      priority={task.priority}
                      taskId={task.id}
                      onUpdate={(priority) => updateTask(task.id, { priority })}
                    />
                  </div>

                  {/* ID и Название */}
                  <div className="flex items-center gap-2 w-[15%]">
                    <span className="text-sm text-gray-500 font-medium">
                      #{task.id}
                    </span>
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {task.title}
                    </span>
                  </div>

                  {/* Дата создания */}
                  <div className="w-[10%]">
                    <span className="text-xs text-gray-500">
                      {task.created_at ? format(new Date(task.created_at), 'MMM dd') : ''}
                    </span>
                  </div>

                  {/* Дополнительные поля (первые 6) */}
                  {task.custom_fields && task.custom_fields.slice(0, 6).map((field: any, index: number) => (
                    <div key={field.id} className="w-[10%]">
                      <span className="text-xs text-gray-500 truncate" title={field.value}>
                        {field.value}
                      </span>
                    </div>
                  ))}

                  {/* Исполнитель (если есть) */}
                  {task.assignee_id && task.assignee_name && (
                    <div className="w-[10%] flex items-center gap-2">
                      <Avatar
                        name={task.assignee_name}
                        imageUrl={`/avatar_${task.assignee_id}.png`}
                        size="sm"
                      />
                      <span className="text-xs text-gray-600 truncate">
                        {task.assignee_name}
                      </span>
                    </div>
                  )}
                </div>
              ))}
              </div>
            )}
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

