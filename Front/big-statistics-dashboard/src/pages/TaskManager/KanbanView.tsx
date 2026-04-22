import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTasks } from './hooks/useTasks';
import { useStatusTranslation } from './hooks/useStatusTranslation';
import { useErrorTranslation } from './hooks/useErrorTranslation';
import { TaskDetailsModal } from './components/TaskDetailsModal';
import { TaskContextMenu } from './components/TaskContextMenu';
import { PriorityIcon } from './components/PrioritySelector';
import { SortOption } from './components/SortSelector';
import { TaskFilters, EMPTY_FILTERS, applyFilters } from './types/filters';
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

interface KanbanViewProps {
  projectId: number;
  refreshKey?: number;
  createTrigger?: number;
  sortBy?: SortOption;
  hideCompleted?: boolean;
  filters?: TaskFilters;
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

interface TaskCardProps {
  task: any;
  onClick?: () => void;
  statuses?: any[];
  onUpdateTask?: (taskId: number, updates: any) => void;
  onDelete?: () => void;
  t?: (key: string) => string;
  translateStatus?: (status: any) => string;
}

// Карточка задачи в стиле Plane
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
        className="w-full bg-white rounded-md border border-gray-200 hover:border-gray-300 hover:shadow-sm cursor-pointer transition-all duration-150 overflow-hidden"
      >
        <div className="flex">
          {/* Левая полоска в цвет статуса */}
          <div className="w-1 shrink-0" style={{ backgroundColor: statusObj.color || priorityColor }} />
          <div className="flex-1 p-2.5">
            {/* ID + статус */}
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-gray-400 font-medium">#{task.id}</span>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: statusObj.color || priorityColor }}
                />
                <span className="text-xs text-gray-700 font-medium truncate whitespace-nowrap max-w-[120px] block">
                  {translateStatus ? translateStatus(statusObj) : task.status_name}
                </span>
              </div>
            </div>

            {/* Заголовок */}
            <p className="text-sm font-medium text-gray-900 mb-2 line-clamp-2 leading-snug">
              {task.title}
            </p>

            {/* Теги */}
            {task.tags && task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {task.tags.map((tag: any) => (
                  <span
                    key={tag.id}
                    className="text-xs px-1.5 py-0.5 rounded font-medium"
                    style={{
                      backgroundColor: `${tag.color}18`,
                      color: tag.color,
                      border: `1px solid ${tag.color}35`,
                    }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}

            {/* Нижняя строка: дедлайн / дата + иконка приоритета + счётчики + исполнитель */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">
                  {task.due_date
                    ? format(new Date(task.due_date), 'dd MMM')
                    : task.created_at
                    ? format(new Date(task.created_at), 'dd MMM')
                    : ''}
                </span>
                <PriorityIcon priority={task.priority || 'medium'} />
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-1.5 py-0.5 rounded shrink-0 font-semibold leading-none ${
                    task.has_approval_requirement && task.approval_conditions_met
                      ? 'bg-green-100'
                      : 'bg-gray-100'
                  } ${
                    task.has_approval_requirement && task.approval_current_user_approved
                      ? 'text-green-600'
                      : 'text-gray-400'
                  }`}
                  title={
                    task.has_approval_requirement
                      ? (task.approval_conditions_met ? 'Approval condition met' : 'Approval condition pending')
                      : 'No approval required'
                  }
                >
                  ✓
                </span>
                {task.subtask_count > 0 && (
                  <span className="flex items-center gap-0.5 text-xs text-gray-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    {task.subtask_count}
                  </span>
                )}
                {task.comment_count > 0 && (
                  <span className="flex items-center gap-0.5 text-xs text-gray-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {task.comment_count}
                  </span>
                )}
                {task.attachment_count > 0 && (
                  <span className="flex items-center gap-0.5 text-xs text-gray-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    {task.attachment_count}
                  </span>
                )}
                {task.assignee_id && task.assignee_name && (
                  <Avatar
                    name={task.assignee_name}
                    imageUrl={`/avatar_${task.assignee_id}.png`}
                    size="sm"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {contextMenuPosition && statuses && onUpdateTask && onDelete && (
        <TaskContextMenu
          task={task}
          statuses={statuses}
          position={contextMenuPosition}
          onUpdate={(updates) => { onUpdateTask(task.id, updates); }}
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

// Колонка статуса
const Lane: React.FC<LaneProps> = ({ status, tasks, statuses, onAddTask, onTaskClick, onUpdateTask, onDeleteTask, t, translateStatus }) => {
  const taskIds = tasks.map((t) => t.id.toString());
  const { setNodeRef, isOver } = useDroppable({
    id: `lane-${status.id}`,
    data: { statusId: status.id },
  });

  return (
    <div className="flex-shrink-0 h-full flex flex-col rounded-lg overflow-hidden border border-gray-200 bg-white" style={{ width: 'calc((100% - 48px) / 5)', minWidth: '200px' }}>
      {/* Заголовок колонки */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
          <span className="text-sm font-semibold text-gray-800">{translateStatus(status)}</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full font-medium">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={onAddTask}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Список задач */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto p-2 space-y-1.5 transition-colors duration-150 ${
          isOver ? 'bg-blue-50' : 'bg-gray-50'
        }`}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              statuses={statuses}
              translateStatus={translateStatus}
              onClick={() => onTaskClick(task)}
              onUpdateTask={async (taskId, updates) => { await onUpdateTask(taskId, updates); }}
              onDelete={() => onDeleteTask(task.id)}
              t={t}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-16 text-xs text-gray-400">
            Нет задач
          </div>
        )}
      </div>
    </div>
  );
};

export const KanbanView: React.FC<KanbanViewProps> = ({
  projectId,
  refreshKey,
  createTrigger,
  sortBy: sortByProp,
  hideCompleted: hideCompletedProp,
  filters = EMPTY_FILTERS,
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
  const sortBy = sortByProp ?? 'priority';
  const hideCompleted = hideCompletedProp ?? false;
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'error' | 'success' | 'warning' }>>([]);

  // Обновляем статусы при изменении refreshKey
  React.useEffect(() => {
    if (refreshKey && refreshKey > 0) {
      fetchStatuses();
    }
  }, [refreshKey, fetchStatuses]);

  // Открываем модалку создания из тулбара
  React.useEffect(() => {
    if (createTrigger && createTrigger > 0) {
      setSelectedStatusId(statuses[0]?.id || null);
      setShowCreateModal(true);
    }
  }, [createTrigger]);

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
        tasks: sortTasks(applyFilters(filteredTasks, filters)),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, statuses, sortBy, hideCompleted, filters]);

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
    try {
      const result = await createTask(taskData);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Неизвестная ошибка';
      showToast(translateError(errorMsg), 'error');
      return null;
    }
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">

      <div className="flex-1 overflow-hidden">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="h-full px-3 py-3">
            <div className="flex h-full gap-3 overflow-x-auto pb-4 w-full">
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
          }}
          onUpdate={async (updates) => {
            await updateTask(selectedTask.id, updates);
            setSelectedTask(null);
          }}
          onDelete={async () => {
            await deleteTask(selectedTask.id);
            setSelectedTask(null);
          }}
          onTaskAutoTransitioned={(taskId, newStatusId) => {
            updateTask(taskId, { status_id: newStatusId });
          }}
        />
      )}

      {/* Модальное окно создания задачи */}
      {showCreateModal && (
        <TaskDetailsModal
          mode="create"
          projectId={projectId}
          initialStatusId={selectedStatusId || statuses[0]?.id || 1}
          statuses={statuses}
          onClose={() => {
            setShowCreateModal(false);
            setSelectedStatusId(null);
          }}
          onCreate={handleCreateTask}
        />
      )}

      {/* Toast уведомления */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};
