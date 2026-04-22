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
  is_favorite?: boolean;
}

const PROJECTS_CACHE_TTL_MS = 5000;
let projectsCache: { data: Project[]; ts: number } | null = null;
let projectsInFlight: Promise<Project[]> | null = null;

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = () => {
    return localStorage.getItem('authToken');
  };

  const fetchProjects = useCallback(async () => {
    try {
      const now = Date.now();
      if (projectsCache && now - projectsCache.ts < PROJECTS_CACHE_TTL_MS) {
        setProjects(projectsCache.data);
        return;
      }

      setLoading(true);
      setError(null);

      if (projectsInFlight) {
        const deduped = await projectsInFlight;
        setProjects(deduped);
        return;
      }

      const token = getToken();
      const requestPromise: Promise<Project[]> = fetch(`${API_BASE}/api/task-manager/projects/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error('Ошибка загрузки проектов');
        }
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Ошибка загрузки проектов');
        }
        return data.data as Project[];
      });

      projectsInFlight = requestPromise;
      const rows = await requestPromise;
      projectsCache = { data: rows, ts: Date.now() };
      setProjects(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      projectsInFlight = null;
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
        projectsCache = null;
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

  const toggleFavorite = useCallback(async (projectId: number, isFavorite: boolean) => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/projects/${projectId}/favorite`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ is_favorite: isFavorite }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Ошибка обновления избранного');
      }

      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, is_favorite: isFavorite } : p))
      );
      if (projectsCache) {
        projectsCache = {
          ...projectsCache,
          data: projectsCache.data.map((p) =>
            p.id === projectId ? { ...p, is_favorite: isFavorite } : p
          ),
        };
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      return false;
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return {
    projects,
    loading,
    error,
    fetchProjects,
    createProject,
    toggleFavorite,
  };
};

