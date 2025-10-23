import { useState, useEffect, useCallback } from 'react';

const API_BASE = '';

interface Comment {
  id: number;
  task_id: number;
  user_id: number;
  username: string;
  full_name: string;
  comment: string;
  created_at: string;
  updated_at: string;
}

export const useComments = (taskId: number) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = () => localStorage.getItem('authToken');

  const fetchComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/comments/task/${taskId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setComments(data.data);
      } else {
        throw new Error(data.error || 'Ошибка загрузки комментариев');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const createComment = useCallback(async (comment: string) => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/comments/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ task_id: taskId, comment }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchComments();
        return true;
      } else {
        throw new Error(data.error || 'Ошибка создания комментария');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      return false;
    }
  }, [taskId, fetchComments]);

  const updateComment = useCallback(async (commentId: number, comment: string) => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ comment }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchComments();
        return true;
      } else {
        throw new Error(data.error || 'Ошибка обновления комментария');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      return false;
    }
  }, [fetchComments]);

  const deleteComment = useCallback(async (commentId: number) => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        await fetchComments();
        return true;
      } else {
        throw new Error(data.error || 'Ошибка удаления комментария');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      return false;
    }
  }, [fetchComments]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  return {
    comments,
    loading,
    error,
    fetchComments,
    createComment,
    updateComment,
    deleteComment,
  };
};

