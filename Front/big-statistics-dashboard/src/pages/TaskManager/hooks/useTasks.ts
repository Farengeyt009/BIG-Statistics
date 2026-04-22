import { useState, useEffect, useCallback, useRef } from 'react';
import { useErrorTranslation } from './useErrorTranslation';

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
  has_approval_requirement?: boolean;
  approval_conditions_met?: boolean;
  approval_current_user_approved?: boolean;
  tags?: Array<{ id: number; name: string; color: string }>;
  custom_fields?: Array<{ id: number; name: string; value: string; type: string }>;
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

const TASKS_CACHE_TTL_MS = 4000;
const STATUSES_CACHE_TTL_MS = 15000;

type TasksCacheEntry = { data: Task[]; ts: number };
type StatusesCacheEntry = { data: WorkflowStatus[]; ts: number };

const tasksCache = new Map<string, TasksCacheEntry>();
const tasksInFlight = new Map<string, Promise<Task[]>>();
const statusesCache = new Map<string, StatusesCacheEntry>();
const statusesInFlight = new Map<string, Promise<WorkflowStatus[]>>();

export const useTasks = (projectId: number) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<WorkflowStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { translateError } = useErrorTranslation();
  const backgroundSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getToken = () => {
    return localStorage.getItem('authToken');
  };

  const recordPerf = (_op: string, _ms: number, _status?: number, _backendMs?: number) => {};

  const fetchStatuses = useCallback(async (options?: { force?: boolean }) => {
    const cacheKey = `${projectId}`;
    const now = Date.now();
    const cached = statusesCache.get(cacheKey);
    const hasFreshCache = !options?.force && cached && (now - cached.ts) < STATUSES_CACHE_TTL_MS;
    if (hasFreshCache) {
      setStatuses(cached.data);
      return cached.data;
    }

    if (!options?.force && statusesInFlight.has(cacheKey)) {
      const data = await statusesInFlight.get(cacheKey)!;
      setStatuses(data);
      return data;
    }

    try {
      const token = getToken();
      const request = (async () => {
        const started = performance.now();
        const response = await fetch(
          `${API_BASE}/api/task-manager/workflow/projects/${projectId}/statuses`,
          {
            headers: { 'Authorization': `Bearer ${token}` },
          }
        );
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Ошибка загрузки статусов');
        }
        const elapsed = performance.now() - started;
        recordPerf('fetchStatuses', elapsed, response.status, data?.meta?.duration_ms);

        const next = data.data as WorkflowStatus[];
        statusesCache.set(cacheKey, { data: next, ts: Date.now() });
        return next;
      })();

      statusesInFlight.set(cacheKey, request);
      const next = await request;
      setStatuses(next);
      return next;
    } catch (err) {
      console.error('Ошибка загрузки статусов:', err);
      return [];
    } finally {
      statusesInFlight.delete(cacheKey);
    }
  }, [projectId]);

  const fetchTasks = useCallback(async (options?: { force?: boolean }) => {
    const cacheKey = `${projectId}:default`;
    const now = Date.now();
    const cached = tasksCache.get(cacheKey);
    const hasFreshCache = !options?.force && cached && (now - cached.ts) < TASKS_CACHE_TTL_MS;
    if (hasFreshCache) {
      setTasks(cached.data);
      return cached.data;
    }

    const inFlight = !options?.force ? tasksInFlight.get(cacheKey) : undefined;
    if (inFlight) {
      setLoading(true);
      try {
        const data = await inFlight;
        setTasks(data);
        return data;
      } finally {
        setLoading(false);
      }
    }

    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const request = (async () => {
        const started = performance.now();
        const response = await fetch(
          `${API_BASE}/api/task-manager/tasks/project/${projectId}?include_tags=1&include_custom_fields=0`,
          {
            headers: { 'Authorization': `Bearer ${token}` },
          }
        );
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Ошибка загрузки задач');
        }
        const elapsed = performance.now() - started;
        recordPerf('fetchTasks', elapsed, response.status, data?.meta?.duration_ms);

        const next = data.data as Task[];
        tasksCache.set(cacheKey, { data: next, ts: Date.now() });
        return next;
      })();

      tasksInFlight.set(cacheKey, request);
      const next = await request;
      setTasks(next);
      return next;
    } catch (err) {
      setError(translateError(err instanceof Error ? err.message : 'Неизвестная ошибка'));
      throw err;
    } finally {
      tasksInFlight.delete(cacheKey);
      setLoading(false);
    }
  }, [projectId, translateError]);

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
      const started = performance.now();
      const response = await fetch(`${API_BASE}/api/task-manager/tasks/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ ...taskData, project_id: projectId }),
      });
      const data = await response.json();
      const elapsed = performance.now() - started;
      recordPerf('createTask', elapsed, response.status, data?.meta?.duration_ms);
      if (data.success) {
        tasksCache.delete(`${projectId}:default`);
        await fetchTasks({ force: true });
        // Возвращаем ID созданной задачи
        return data.data?.id || null;
      } else {
        throw new Error(data.error || 'Ошибка создания задачи');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Неизвестная ошибка';
      setError(translateError(errorMsg));
      throw err; // пробрасываем дальше для обработки в UI
    }
  }, [projectId, fetchTasks]);

  const updateTask = useCallback(async (taskId: number, updates: Partial<Task>) => {
    const tasksCacheKey = `${projectId}:default`;

    // Оптимистичное обновление только для status_id (drag&drop)
    if (updates.status_id !== undefined && Object.keys(updates).length === 1) {
      setTasks((prevTasks) => {
        const nextTasks = prevTasks.map((task) =>
          task.id === taskId ? { ...task, ...updates } : task
        );
        tasksCache.set(tasksCacheKey, { data: nextTasks, ts: Date.now() });
        return nextTasks;
      });
    }

    console.log('Saving task updates:', taskId, updates); // Отладка

    try {
      const prevTask = tasks.find(t => t.id === taskId);
      const token = getToken();
      const started = performance.now();
      const response = await fetch(`${API_BASE}/api/task-manager/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      const data = await response.json();
      const elapsed = performance.now() - started;
      recordPerf('updateTask', elapsed, response.status, data?.meta?.duration_ms);
      
      if (data.success) {
        // Для сложных кейсов делаем полный refresh сразу.
        // Для простых полей и статуса — мгновенно патчим локально + фоновый re-sync.
        const statusChanged = prevTask
          ? updates.status_id !== undefined && updates.status_id !== prevTask.status_id
          : updates.status_id !== undefined;
        const hasComplexFields = ('tags' in updates) || ('custom_fields' in updates);
        const statusOnlyUpdate = updates.status_id !== undefined && Object.keys(updates).length === 1;
        const requiresImmediateRefresh = hasComplexFields;

        if (requiresImmediateRefresh) {
          tasksCache.delete(tasksCacheKey);
          await fetchTasks({ force: true });
        } else {
          setTasks((prev) => {
            const nextTasks = prev.map((task) => {
              if (task.id !== taskId) return task;
              const nextTask: Task = {
                ...task,
                ...updates,
                updated_at: new Date().toISOString(),
              };

              // Для drag&drop статуса сразу обновляем имя/цвет из справочника статусов.
              if (statusOnlyUpdate && updates.status_id !== undefined) {
                const targetStatus = statuses.find((s) => s.id === updates.status_id);
                if (targetStatus) {
                  nextTask.status_name = targetStatus.name;
                  nextTask.status_color = targetStatus.color;
                }
              }

              return nextTask;
            });
            tasksCache.set(tasksCacheKey, { data: nextTasks, ts: Date.now() });
            return nextTasks;
          });

          // Автопереходы/серверные триггеры всё равно могут изменить задачу:
          // делаем отложенный фоновый sync без блокировки UI.
          if (backgroundSyncTimerRef.current) {
            clearTimeout(backgroundSyncTimerRef.current);
          }
          backgroundSyncTimerRef.current = setTimeout(() => {
            fetchTasks({ force: true }).catch(() => {});
          }, statusChanged ? 700 : 1200);
        }
        return true;
      } else {
        // Откат при ошибке
        tasksCache.delete(tasksCacheKey);
        await fetchTasks({ force: true });
        const errorMsg = data.error || 'Ошибка обновления задачи';
        setError(translateError(errorMsg));
        throw new Error(errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Неизвестная ошибка';
      setError(translateError(errorMsg));
      // Откатываем изменения
      tasksCache.delete(tasksCacheKey);
      await fetchTasks({ force: true });
      throw err; // Пробрасываем дальше
    }
  }, [fetchTasks, tasks, projectId, translateError, statuses]);

  const deleteTask = useCallback(async (taskId: number) => {
    try {
      const token = getToken();
      const started = performance.now();
      const response = await fetch(`${API_BASE}/api/task-manager/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      const elapsed = performance.now() - started;
      recordPerf('deleteTask', elapsed, response.status, data?.meta?.duration_ms);
      if (data.success) {
        tasksCache.delete(`${projectId}:default`);
        await fetchTasks({ force: true });
        return true;
      } else {
        throw new Error(data.error || 'Ошибка удаления задачи');
      }
    } catch (err) {
      setError(translateError(err instanceof Error ? err.message : 'Неизвестная ошибка'));
      return false;
    }
  }, [fetchTasks, projectId, translateError]);

  useEffect(() => {
    fetchStatuses();
    fetchTasks();
  }, [fetchStatuses, fetchTasks]);

  useEffect(() => {
    return () => {
      if (backgroundSyncTimerRef.current) {
        clearTimeout(backgroundSyncTimerRef.current);
      }
    };
  }, []);

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

