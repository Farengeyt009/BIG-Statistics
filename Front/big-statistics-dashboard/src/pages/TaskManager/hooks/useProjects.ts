import { useState, useEffect, useCallback } from 'react';

const API_BASE = ''; // Используем относительные URL через Vite proxy

interface Project {
  id: number;
  name: string;
  description: string;
  category_id?: number;
  category_name?: string;
  category_color?: string;
  owner_id: number;
  owner_name: string;
  user_role: string;
  has_workflow_permissions: boolean;
  task_count: number;
  member_count: number;
  created_at: string;
  updated_at: string;
  members?: Array<{ user_id: number; username: string; full_name: string }>;
}

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = () => {
    return localStorage.getItem('authToken');
  };

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/projects/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки проектов');
      }

      const data = await response.json();
      if (data.success) {
        setProjects(data.data);
      } else {
        throw new Error(data.error || 'Ошибка загрузки проектов');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  }, []);

  const createProject = useCallback(async (projectData: {
    name: string;
    description?: string;
    category_id?: number;
    has_workflow_permissions?: boolean;
  }) => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/projects/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(projectData),
      });

      const data = await response.json();
      if (data.success) {
        await fetchProjects();
        return true;
      } else {
        throw new Error(data.error || 'Ошибка создания проекта');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      return false;
    }
  }, [fetchProjects]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return {
    projects,
    loading,
    error,
    fetchProjects,
    createProject,
  };
};

