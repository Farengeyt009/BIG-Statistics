import React, { useState, useEffect } from 'react';
import { PrioritySelector } from './PrioritySelector';
import { format } from 'date-fns';

interface SubtasksSectionProps {
  taskId: number;
  projectId: number;
  statuses: any[];
  onCountChange?: (count: number) => void;
}

const API_BASE = '';

export const SubtasksSection: React.FC<SubtasksSectionProps> = ({
  taskId,
  projectId,
  statuses,
  onCountChange,
}) => {
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Обновляем счетчик только после первой загрузки данных
  React.useEffect(() => {
    if (onCountChange && !loading && subtasks.length >= 0) {
      onCountChange(subtasks.length);
    }
  }, [subtasks.length, loading]);

  const getToken = () => localStorage.getItem('authToken');

  const fetchSubtasks = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const response = await fetch(
        `${API_BASE}/api/task-manager/tasks/project/${projectId}?parent_task_id=${taskId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      const data = await response.json();
      if (data.success) {
        setSubtasks(data.data);
      }
    } catch (err) {
      console.error('Ошибка загрузки подзадач:', err);
    } finally {
      setLoading(false);
    }
  };

  const createSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;

    setIsCreating(true);
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/tasks/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          project_id: projectId,
          title: newSubtaskTitle,
          parent_task_id: taskId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setNewSubtaskTitle('');
        await fetchSubtasks();
      }
    } catch (err) {
      console.error('Ошибка создания подзадачи:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const toggleSubtaskComplete = async (subtask: any) => {
    // Находим финальный статус
    const finalStatus = statuses.find((s) => s.is_final && !s.name.includes('Отмена'));
    const initialStatus = statuses.find((s) => s.is_initial);

    if (!finalStatus || !initialStatus) return;

    const newStatusId = subtask.status_id === finalStatus.id ? initialStatus.id : finalStatus.id;
    
    // Обновляем через API напрямую
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/task-manager/tasks/${subtask.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status_id: newStatusId }),
      });
      
      if (response.ok) {
        await fetchSubtasks();
      }
    } catch (err) {
      console.error('Ошибка обновления подзадачи:', err);
    }
  };

  useEffect(() => {
    fetchSubtasks();
  }, [taskId]);

  if (loading && subtasks.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500 text-sm">Загрузка подзадач...</div>
      </div>
    );
  }

  const completedCount = subtasks.filter((s) =>
    statuses.find((st) => st.id === s.status_id)?.is_final
  ).length;

  return (
    <div className="space-y-4">
      {/* Прогресс */}
      {subtasks.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${subtasks.length > 0 ? (completedCount / subtasks.length) * 100 : 0}%`,
              }}
            />
          </div>
          <span className="text-sm text-gray-600">
            {completedCount} / {subtasks.length}
          </span>
        </div>
      )}

      {/* Список подзадач */}
      <div className="space-y-2">
        {subtasks.map((subtask) => {
          const isCompleted = statuses.find((s) => s.id === subtask.status_id)?.is_final;
          
          return (
            <div
              key={subtask.id}
              className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group border border-gray-100"
            >
              {/* Первая строка: чекбокс, приоритет, название */}
              <div className="flex items-start gap-2">
                {/* Чекбокс */}
                <button
                  onClick={() => toggleSubtaskComplete(subtask)}
                  className={`w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors mt-0.5 ${
                    isCompleted
                      ? 'bg-green-500 border-green-500'
                      : 'border-gray-300 hover:border-green-500'
                  }`}
                >
                  {isCompleted && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                {/* Приоритет */}
                <div className="shrink-0">
                  <PrioritySelector
                    priority={subtask.priority}
                    taskId={subtask.id}
                    onUpdate={async (priority) => {
                      try {
                        const token = localStorage.getItem('authToken');
                        await fetch(`/api/task-manager/tasks/${subtask.id}`, {
                          method: 'PUT',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                          },
                          body: JSON.stringify({ priority }),
                        });
                        await fetchSubtasks();
                      } catch (err) {
                        console.error('Ошибка обновления приоритета:', err);
                      }
                    }}
                  />
                </div>

                {/* Название - с переносом если длинное */}
                <span
                  className={`flex-1 text-sm leading-snug ${
                    isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'
                  }`}
                  style={{
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                  }}
                >
                  {subtask.title}
                </span>

                {/* Удалить */}
                <button
                  onClick={async () => {
                    if (confirm('Удалить подзадачу?')) {
                      try {
                        const token = localStorage.getItem('authToken');
                        await fetch(`/api/task-manager/tasks/${subtask.id}`, {
                          method: 'DELETE',
                          headers: { 'Authorization': `Bearer ${token}` },
                        });
                        await fetchSubtasks();
                      } catch (err) {
                        console.error('Ошибка удаления подзадачи:', err);
                      }
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 shrink-0 p-1 text-gray-400 hover:text-red-600 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Вторая строка: метаинформация */}
              <div className="flex items-center gap-3 ml-7 text-xs text-gray-500">
                {/* Срок выполнения */}
                <div className="relative group/date">
                  {subtask.due_date ? (
                    <button
                      onClick={(e) => {
                        e.currentTarget.nextElementSibling?.querySelector('input')?.showPicker();
                      }}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded hover:bg-gray-200 transition-colors ${
                        new Date(subtask.due_date) < new Date() && !isCompleted
                          ? 'text-red-600 bg-red-50'
                          : 'text-gray-700'
                      }`}
                      title="Изменить срок"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {format(new Date(subtask.due_date), 'dd.MM.yyyy')}
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.currentTarget.nextElementSibling?.querySelector('input')?.showPicker();
                      }}
                      className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-700"
                      title="Установить срок"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Срок
                    </button>
                  )}
                  <div className="absolute opacity-0 pointer-events-none">
                    <input
                      type="date"
                      value={subtask.due_date ? format(new Date(subtask.due_date), 'yyyy-MM-dd') : ''}
                      onChange={async (e) => {
                        try {
                          const token = localStorage.getItem('authToken');
                          await fetch(`/api/task-manager/tasks/${subtask.id}`, {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`,
                            },
                            body: JSON.stringify({ due_date: e.target.value || null }),
                          });
                          await fetchSubtasks();
                        } catch (err) {
                          console.error('Ошибка установки срока:', err);
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Исполнитель */}
                {subtask.assignee_id && subtask.assignee_name && (
                  <div className="flex items-center gap-1">
                    <img
                      src={`/avatar_${subtask.assignee_id}.png`}
                      alt={subtask.assignee_name}
                      className="w-4 h-4 rounded-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = '';
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <span>{subtask.assignee_name}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Добавление новой подзадачи */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newSubtaskTitle}
          onChange={(e) => setNewSubtaskTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              createSubtask();
            }
          }}
          placeholder="Добавить подзадачу..."
          className="flex-1 px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
        <button
          onClick={createSubtask}
          disabled={isCreating || !newSubtaskTitle.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
        >
          {isCreating ? 'Создание...' : 'Добавить'}
        </button>
      </div>
    </div>
  );
};

