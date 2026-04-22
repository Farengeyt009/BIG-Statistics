import { useState, useEffect, useCallback } from 'react';

const API_BASE = '';
const COMMENTS_CACHE_TTL_MS = 5000;

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

const commentsCache = new Map<number, { data: Comment[]; ts: number }>();
const commentsInFlight = new Map<number, Promise<Comment[]>>();

export const useComments = (taskId: number) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = () => localStorage.getItem('authToken');

  const recordPerf = (_op: string, _ms: number, _status?: number) => {};

  const fetchComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now = Date.now();
      const cached = commentsCache.get(taskId);
      if (cached && now - cached.ts < COMMENTS_CACHE_TTL_MS) {
        setComments(cached.data);
        return;
      }

      const inFlight = commentsInFlight.get(taskId);
      if (inFlight) {
        const sharedData = await inFlight;
        setComments(sharedData);
        return;
      }

      const token = getToken();
      const started = performance.now();
      const requestPromise = fetch(`${API_BASE}/api/task-manager/comments/task/${taskId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      }).then(async (response) => {
        recordPerf('fetchComments', performance.now() - started, response.status);
        const payload = await response.json();
        if (!payload.success) {
          throw new Error(payload.error || 'Ошибка загрузки комментариев');
        }
        return payload.data as Comment[];
      });

      commentsInFlight.set(taskId, requestPromise);
      const data = await requestPromise;
      commentsInFlight.delete(taskId);
      commentsCache.set(taskId, { data, ts: Date.now() });
      setComments(data);
    } catch (err) {
      commentsInFlight.delete(taskId);
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const createComment = useCallback(async (comment: string) => {
    try {
      const token = getToken();
      const started = performance.now();
      const response = await fetch(`${API_BASE}/api/task-manager/comments/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ task_id: taskId, comment }),
      });
      recordPerf('createComment', performance.now() - started, response.status);

      const data = await response.json();
      if (data.success) {
        commentsCache.delete(taskId);
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
      const started = performance.now();
      const response = await fetch(`${API_BASE}/api/task-manager/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ comment }),
      });
      recordPerf('updateComment', performance.now() - started, response.status);

      const data = await response.json();
      if (data.success) {
        commentsCache.delete(taskId);
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
      const started = performance.now();
      const response = await fetch(`${API_BASE}/api/task-manager/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      recordPerf('deleteComment', performance.now() - started, response.status);

      const data = await response.json();
      if (data.success) {
        commentsCache.delete(taskId);
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

