import { useState, useEffect, useCallback } from 'react';

const API_BASE = '';

interface Transition {
  id: number;
  project_id: number;
  from_status_id: number;
  from_status_name: string;
  to_status_id: number;
  to_status_name: string;
  name: string;
  permission_type: string;
  allowed_roles?: string;
  allowed_users?: string;
}

export const useTransitions = (projectId: number) => {
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [loading, setLoading] = useState(false);

  const getToken = () => localStorage.getItem('authToken');

  const fetchTransitions = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      const response = await fetch(
        `${API_BASE}/api/task-manager/workflow/projects/${projectId}/transitions`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      const data = await response.json();
      if (data.success) {
        setTransitions(data.data);
      }
    } catch (err) {
      console.error('Ошибка загрузки переходов:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const deleteTransition = useCallback(async (transitionId: number) => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/workflow/transitions/${transitionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        await fetchTransitions();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Ошибка удаления перехода:', err);
      return false;
    }
  }, [fetchTransitions]);

  useEffect(() => {
    fetchTransitions();
  }, [fetchTransitions]);

  return {
    transitions,
    loading,
    fetchTransitions,
    deleteTransition,
  };
};

