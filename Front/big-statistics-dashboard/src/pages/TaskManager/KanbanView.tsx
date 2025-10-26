import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTasks } from './hooks/useTasks';
import { useStatusTranslation } from './hooks/useStatusTranslation';
import { useErrorTranslation } from './hooks/useErrorTranslation';
import { TaskDetailsModal } from './components/TaskDetailsModal';
import { CreateTaskModal } from './components/CreateTaskModal';
import { TaskContextMenu } from './components/TaskContextMenu';
import { PrioritySelector } from './components/PrioritySelector';
import { StatusSelector } from './components/StatusSelector';
import { SortSelector, SortOption } from './components/SortSelector';
import { Avatar } from './components/ui/Avatar';
import { ToastContainer } from './components/Toast';
import TaskManagerTranslation from './TaskManagerTranslation.json';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { format } from 'date-fns';

// Обновленный интерфейс для KanbanView

interface KanbanViewProps {
  projectId: number;
  onBackToProjects?: () => void;
  onOpenSettings?: () => void;
  viewType?: 'list' | 'grid' | 'attachments';
  onViewTypeChange?: (viewType: 'list' | 'grid' | 'attachments') => void;
  refreshKey?: number;
}

const priorityIcons: Record<string, string> = {
  low: '◔',
  medium: '◑',
  high: '◕',
  critical: '●',
};

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

interface TaskCardProps {
  task: any;
  onClick?: () => void;
  statuses?: any[];
  onUpdateTask?: (taskId: number, updates: any) => void;
  onDelete?: () => void;
  t?: (key: string) => string;
  translateStatus?: (status: any) => string;
}

// Карточка задачи в стиле Linear/Circle
const TaskCard: React.FC<TaskCardProps> = ({ task, onClick, statuses, onUpdateTask, onDelete, t, translateStatus }) => {
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id.toString(),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 150ms ease',
    opacity: isDragging ? 0.5 : 1,
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  };

  const priorityColor = priorityColors[task.priority || 'medium'];

  const systemStatusNames = ['Новая', 'В работе', 'Завершена', 'Отменена'];
  const statusObj = statuses?.find((s: any) => s.id === task.status_id) || 
    { 
      id: task.status_id, 
      name: task.status_name, 
      color: task.status_color, 
      is_system: systemStatusNames.includes(task.status_name) 
    };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={onClick}
        onContextMenu={handleContextMenu}
        className="w-full p-2.5 bg-white rounded-md border border-gray-200 hover:border-gray-300 cursor-pointer transition-colors duration-150"
      >
      {/* Верхняя строка: приоритет, ID, статус */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          {onUpdateTask ? (
            <PrioritySelector
              priority={task.priority}
              taskId={task.id}
              onUpdate={(priority) => onUpdateTask(task.id, { priority })}
            />
          ) : (
            <span 
              className="text-sm font-medium"
              style={{ color: priorityColor }}
            >
              {priorityIcons[task.priority || 'medium']}
            </span>
          )}
          <span className="text-xs text-gray-500 font-medium">
            #{task.id}
          </span>
        </div>
        {onUpdateTask && statuses ? (
          <StatusSelector
            status={{
              id: task.status_id,
              name: task.status_name,
              color: task.status_color,
            }}
            statuses={statuses}
            taskId={task.id}
            onUpdate={(statusId) => onUpdateTask(task.id, { status_id: statusId })}
          />
        ) : (
          <span className="text-xs text-gray-600 capitalize">
            {translateStatus(statusObj)}
          </span>
        )}
      </div>

      {/* Заголовок */}
      <h3 className="text-sm font-semibold text-gray-900 mb-2 line-clamp-2 leading-snug">
        {task.title}
      </h3>

      {/* Теги и проект */}
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[1.5rem]">
        {task.tags && task.tags.map((tag: any) => (
          <span
            key={tag.id}
            className="text-xs px-2 py-0.5 rounded font-medium"
            style={{
              backgroundColor: `${tag.color}15`,
              color: tag.color,
              border: `1px solid ${tag.color}30`,
            }}
          >
            {tag.name}
          </span>
        ))}
      </div>

      {/* Нижняя строка: дата и метаданные */}
      <div className="flex items-center justify-between pt-1.5">
        <span className="text-xs text-gray-500">
          {task.created_at ? format(new Date(task.created_at), 'MMM dd') : ''}
        </span>
        <div className="flex items-center gap-2">
          {/* Счетчики с иконками */}
          {task.subtask_count > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-gray-500" title={t ? t('subtasks') : 'Подзадачи'}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              {task.subtask_count}
            </span>
          )}
          {task.comment_count > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-gray-500" title={t ? t('comments') : 'Комментарии'}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {task.comment_count}
            </span>
          )}
          {task.attachment_count > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-gray-500" title={t ? t('attachments') : 'Файлы'}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {task.attachment_count}
            </span>
          )}
          {/* Исполнитель */}
          {task.assignee_id && task.assignee_name && (
            <div className="shrink-0">
              <Avatar
                name={task.assignee_name}
                imageUrl={`/avatar_${task.assignee_id}.png`}
                size="sm"
              />
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Контекстное меню */}
    {contextMenuPosition && statuses && onUpdateTask && onDelete && (
      <TaskContextMenu
        task={task}
        statuses={statuses}
        position={contextMenuPosition}
        onUpdate={(updates) => {
          onUpdateTask(task.id, updates);
        }}
        onDelete={onDelete}
        onOpen={() => onClick?.()}
        onClose={() => setContextMenuPosition(null)}
      />
    )}
  </>
  );
};

interface LaneProps {
  status: any;
  tasks: any[];
  statuses: any[];
  onAddTask: () => void;
  onTaskClick: (task: any) => void;
  onUpdateTask: (taskId: number, updates: any) => void;
  onDeleteTask: (taskId: number) => void;
  t?: (key: string) => string;
  translateStatus?: (status: any) => string;
}

// Колонка статуса в стиле Linear/Circle
const Lane: React.FC<LaneProps> = ({ status, tasks, statuses, onAddTask, onTaskClick, onUpdateTask, onDeleteTask, t, translateStatus }) => {
  const taskIds = tasks.map((t) => t.id.toString());
  const { setNodeRef, isOver } = useDroppable({
    id: `lane-${status.id}`,
    data: { statusId: status.id },
  });

  return (
    <div 
      className="flex-shrink-0 w-[280px] h-full flex flex-col rounded-md overflow-hidden border border-gray-200"
      style={{ backgroundColor: `${status.color}08` }}
    >
      {/* Заголовок колонки */}
      <div
        className="sticky top-0 z-10 h-[50px] rounded-t-md"
        style={{ backgroundColor: `${status.color}15` }}
      >
        <div className="w-full h-full flex items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: status.color }}
            />
            <span className="text-sm font-medium text-gray-900">
              {translateStatus(status)}
            </span>
            <span className="text-sm text-gray-500">
              {tasks.length}
            </span>
          </div>

          <button
            onClick={onAddTask}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Список задач */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto p-1.5 space-y-1.5 transition-colors duration-150 ${
          isOver ? 'bg-blue-50' : ''
        }`}
        style={{ 
          backgroundColor: isOver ? '' : `${status.color}05`
        }}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard 
              key={task.id} 
              task={task}
              statuses={statuses}
              translateStatus={translateStatus}
              onClick={() => onTaskClick(task)}
              onUpdateTask={async (taskId, updates) => {
                await onUpdateTask(taskId, updates);
              }}
              onDelete={() => onDeleteTask(task.id)}
              t={t}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
};

export const KanbanView: React.FC<KanbanViewProps> = ({ 
  projectId, 
  onBackToProjects, 
  onOpenSettings, 
  viewType, 
  onViewTypeChange,
  refreshKey 
}) => {
  const { t, i18n } = useTranslation('taskManager');
  const { translateStatus } = useStatusTranslation();
  const { translateError } = useErrorTranslation();
  const { tasks, statuses, loading, error, updateTask, createTask, deleteTask, fetchTasks, fetchStatuses } = useTasks(projectId);
  
  // Load translations for Task Manager
  React.useEffect(() => {
    const currentLang = i18n.language;
    if (TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(currentLang, 'taskManager', TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedStatusId, setSelectedStatusId] = useState<number | null>(null);
  const [activeTask, setActiveTask] = useState<any>(null);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [sortBy, setSortBy] = useState<SortOption>('priority');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'error' | 'success' | 'warning' }>>([]);

  // Обновляем статусы при изменении refreshKey
  React.useEffect(() => {
    if (refreshKey && refreshKey > 0) {
      fetchStatuses();
    }
  }, [refreshKey, fetchStatuses]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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

  // Отсортированные задачи по статусам с учетом скрытия завершенных
  const sortedTasksByStatus = useMemo(() => {
    return statuses.map((status) => {
      let filteredTasks = tasks.filter((t) => t.status_id === status.id);
      
      // Скрываем завершенные если включена опция
      if (hideCompleted && status.is_final) {
        filteredTasks = [];
      }
      
      return {
        status,
        tasks: sortTasks(filteredTasks),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, statuses, sortBy, hideCompleted]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id.toString() === event.active.id);
    setActiveTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = parseInt(active.id as string);
    const task = tasks.find((t) => t.id === taskId);
    
    if (!task) return;

    let newStatusId: number | null = null;

    if (over.id.toString().startsWith('lane-')) {
      const statusId = parseInt(over.id.toString().replace('lane-', ''));
      newStatusId = statusId;
    } else {
      const overTask = tasks.find((t) => t.id.toString() === over.id);
      if (overTask) {
        newStatusId = overTask.status_id;
      }
    }

    if (newStatusId && newStatusId !== task.status_id) {
      try {
        const success = await updateTask(taskId, { status_id: newStatusId });
        if (!success) {
          // Показываем toast с ошибкой
          // Ошибка уже переведена в useTasks и находится в state.error
          // Ждем немного, чтобы state обновился
          setTimeout(() => {
            if (error) {
              showToast(error, 'error');
            }
          }, 100);
        }
      } catch (err: any) {
        // Получаем ключ ошибки из err.message и переводим его
        const errorKey = err.message || 'moveTaskError';
        const translatedError = translateError(errorKey);
        showToast(translatedError, 'error');
      }
    }
  };

  const showToast = (message: string, type: 'error' | 'success' | 'warning') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleCreateTask = async (taskData: any) => {
    const success = await createTask(taskData);
    return success;
  };

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
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
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
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              hideCompleted
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
            title={hideCompleted ? t('showCompleted') : t('hideCompleted')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      <div className="flex-1 overflow-hidden bg-white">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="h-full px-2 py-2 bg-white">
            <div className="flex h-full gap-3 overflow-x-auto pb-4">
              {sortedTasksByStatus
                .sort((a, b) => a.status.order_index - b.status.order_index)
                .map(({ status, tasks: statusTasks }) => (
                  <Lane
                    key={status.id}
                    status={status}
                    tasks={statusTasks}
                    statuses={statuses}
                    translateStatus={translateStatus}
                    onAddTask={() => {
                      setSelectedStatusId(status.id);
                      setShowCreateModal(true);
                    }}
                    onTaskClick={setSelectedTask}
                    onUpdateTask={async (taskId, updates) => {
                      await updateTask(taskId, updates);
                    }}
                    onDeleteTask={async (taskId) => {
                      await deleteTask(taskId);
                    }}
                    t={t}
                  />
                ))}
            </div>
          </div>

          <DragOverlay>
            {activeTask ? (
              <div style={{ width: '280px' }}>
                <TaskCard 
                  task={activeTask} 
                  statuses={statuses}
                  translateStatus={translateStatus}
                  t={t} 
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Модальное окно просмотра/редактирования задачи */}
      {selectedTask && (
        <TaskDetailsModal
          task={selectedTask}
          statuses={statuses}
          onClose={() => {
            setSelectedTask(null);
            fetchTasks(); // Обновляем при закрытии (на случай автоперевода)
          }}
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

      {/* Модальное окно создания задачи */}
      <CreateTaskModal
        isOpen={showCreateModal}
        statusId={selectedStatusId || statuses[0]?.id || 1}
        statuses={statuses}
        projectId={projectId}
        onClose={() => {
          setShowCreateModal(false);
          setSelectedStatusId(null);
        }}
        onCreate={handleCreateTask}
      />

      {/* Toast уведомления */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};
