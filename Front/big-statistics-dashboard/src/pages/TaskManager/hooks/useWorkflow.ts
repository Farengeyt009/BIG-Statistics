import { useState, useEffect, useCallback } from 'react';

const API_BASE = '';

interface WorkflowStatus {
  id: number;
  project_id: number;
  name: string;
  color: string;
  is_initial: boolean;
  is_final: boolean;
  is_system: boolean;
  order_index: number;
}

export const useWorkflow = (projectId: number) => {
  const [statuses, setStatuses] = useState<WorkflowStatus[]>([]);
  const [loading, setLoading] = useState(false);

  const getToken = () => localStorage.getItem('authToken');

  const fetchStatuses = useCallback(async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const createStatus = useCallback(async (statusData: {
    name: string;
    color: string;
    is_initial?: boolean;
    is_final?: boolean;
  }) => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/workflow/statuses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ ...statusData, project_id: projectId }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchStatuses();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Ошибка создания статуса:', err);
      return false;
    }
  }, [projectId, fetchStatuses]);

  const updateStatus = useCallback(async (statusId: number, updates: any) => {
    // Оптимистичное обновление
    setStatuses((prev) =>
      prev.map((s) => (s.id === statusId ? { ...s, ...updates } : s))
    );

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/workflow/statuses/${statusId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();
      if (data.success) {
        // Не перезагружаем сразу - оптимистичное обновление уже сработало
        // Только для синхронизации через некоторое время
        setTimeout(() => fetchStatuses(), 500);
        return true;
      } else {
        // При ошибке откатываем
        await fetchStatuses();
        return false;
      }
    } catch (err) {
      console.error('Ошибка обновления статуса:', err);
      // При ошибке откатываем
      await fetchStatuses();
      return false;
    }
  }, [fetchStatuses]);

  const deleteStatus = useCallback(async (statusId: number) => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/workflow/statuses/${statusId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        await fetchStatuses();
        return true;
      } else {
        // Показываем ошибку от сервера
        alert(data.error || 'Ошибка удаления статуса');
        return false;
      }
    } catch (err) {
      console.error('Ошибка удаления статуса:', err);
      alert('Ошибка удаления статуса');
      return false;
    }
  }, [fetchStatuses]);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  return {
    statuses,
    loading,
    fetchStatuses,
    createStatus,
    updateStatus,
    deleteStatus,
  };
};

