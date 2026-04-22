import { useState, useCallback } from 'react';
import { fetchJsonGetDedup, invalidateGetDedup } from '../../../utils/fetchDedup';

export interface StatusPermission {
  status_id: number;
  user_ids: string | null;      // JSON array string
  department_ids: string | null; // JSON array string
}

export interface StatusPermissionsData {
  enabled: boolean;
  permissions: StatusPermission[];
}

export const useStatusPermissions = (projectId: number) => {
  const [data, setData] = useState<StatusPermissionsData>({ enabled: false, permissions: [] });
  const [loading, setLoading] = useState(false);

  const getToken = () => localStorage.getItem('authToken');

  const fetch = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const token = getToken();
      const json = await fetchJsonGetDedup<any>(
        `/api/task-manager/workflow/status-permissions/${projectId}`,
        token,
        500
      );
      if (json.success) setData(json.data);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const setToggle = useCallback(async (enabled: boolean) => {
    const token = getToken();
    const res = await window.fetch(
      `/api/task-manager/workflow/status-permissions/${projectId}/toggle`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled }),
      }
    );
    const json = await res.json();
    if (json.success) {
      invalidateGetDedup(`/api/task-manager/workflow/status-permissions/${projectId}`, token);
      setData(prev => ({ ...prev, enabled }));
    }
    return json.success;
  }, [projectId]);

  const savePermission = useCallback(async (
    statusId: number,
    userIds: number[],
    departmentIds: number[]
  ) => {
    const token = getToken();
    const res = await window.fetch(
      `/api/task-manager/workflow/status-permissions/${projectId}/status/${statusId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          user_ids: userIds.length > 0 ? JSON.stringify(userIds) : null,
          department_ids: departmentIds.length > 0 ? JSON.stringify(departmentIds) : null,
        }),
      }
    );
    const json = await res.json();
    if (json.success) {
      invalidateGetDedup(`/api/task-manager/workflow/status-permissions/${projectId}`, token);
      await fetch();
    }
    return json.success;
  }, [projectId, fetch]);

  const deletePermission = useCallback(async (statusId: number) => {
    const token = getToken();
    const res = await window.fetch(
      `/api/task-manager/workflow/status-permissions/${projectId}/status/${statusId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const json = await res.json();
    if (json.success) {
      invalidateGetDedup(`/api/task-manager/workflow/status-permissions/${projectId}`, token);
      await fetch();
    }
    return json.success;
  }, [projectId, fetch]);

  return { data, loading, fetch, setToggle, savePermission, deletePermission };
};
