import { useState, useEffect, useCallback } from 'react';

const API_BASE = ''; // Используем относительные URL через Vite proxy

interface Task {
  id: number;
  project_id: number;
  parent_task_id?: number;
  title: string;
  description?: string;
  status_id: number;
  status_name: string;
  status_color: string;
  assignee_id?: number;
  assignee_name?: string;
  assignee_full_name?: string;
  creator_id: number;
  creator_name?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  due_date?: string;
  order_index: number;
  created_at: string;
  updated_at: string;
  subtask_count: number;
  comment_count: number;
  attachment_count: number;
  tags?: Array<{ id: number; name: string; color: string }>;
}

interface WorkflowStatus {
  id: number;
  project_id: number;
  name: string;
  color: string;
  order_index: number;
  is_initial: boolean;
  is_final: boolean;
  task_count: number;
}

export const useTasks = (projectId: number) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<WorkflowStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = () => {
    return localStorage.getItem('authToken');
  };

  const fetchStatuses = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch(
        `${API_BASE}/api/task-manager/workflow/projects/${projectId}/statuses`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      const data = await response.json();
      if (data.success) {
        setStatuses(data.data);
      }
    } catch (err) {
      console.error('Ошибка загрузки статусов:', err);
    }
  }, [projectId]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const response = await fetch(
        `${API_BASE}/api/task-manager/tasks/project/${projectId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      const data = await response.json();
      if (data.success) {
        setTasks(data.data);
      } else {
        throw new Error(data.error || 'Ошибка загрузки задач');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const createTask = useCallback(async (taskData: {
    title: string;
    description?: string;
    status_id?: number;
    assignee_id?: number;
    priority?: string;
    due_date?: string;
    parent_task_id?: number;
    tag_ids?: number[];
  }) => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/tasks/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ ...taskData, project_id: projectId }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchTasks();
        // Возвращаем ID созданной задачи
        return data.data?.id || null;
      } else {
        throw new Error(data.error || 'Ошибка создания задачи');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      return null;
    }
  }, [projectId, fetchTasks]);

  const updateTask = useCallback(async (taskId: number, updates: Partial<Task>) => {
    // Оптимистичное обновление только для status_id (drag&drop)
    if (updates.status_id !== undefined && Object.keys(updates).length === 1) {
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === taskId ? { ...task, ...updates } : task
        )
      );
    }

    console.log('Saving task updates:', taskId, updates); // Отладка

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();
      
      if (data.success) {
        // Перезагружаем данные с сервера после успешного сохранения
        await fetchTasks();
        return true;
      } else {
        // Откат при ошибке
        await fetchTasks();
        const errorMsg = data.error || 'Ошибка обновления задачи';
        setError(errorMsg);
        throw new Error(errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Неизвестная ошибка';
      setError(errorMsg);
      // Откатываем изменения
      await fetchTasks();
      throw err; // Пробрасываем дальше
    }
  }, [fetchTasks]);

  const deleteTask = useCallback(async (taskId: number) => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        await fetchTasks();
        return true;
      } else {
        throw new Error(data.error || 'Ошибка удаления задачи');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      return false;
    }
  }, [fetchTasks]);

  useEffect(() => {
    fetchStatuses();
    fetchTasks();
  }, [fetchStatuses, fetchTasks]);

  return {
    tasks,
    statuses,
    loading,
    error,
    fetchTasks,
    fetchStatuses,
    createTask,
    updateTask,
    deleteTask,
  };
};

