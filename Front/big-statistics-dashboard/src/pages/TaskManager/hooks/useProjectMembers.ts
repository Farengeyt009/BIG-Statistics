import { useState, useEffect, useCallback } from 'react';

const API_BASE = '';

interface Member {
  id: number;
  user_id: number;
  username: string;
  full_name: string;
  department: string;
  role: string;
  added_at: string;
  added_by_name: string;
}

interface User {
  user_id: number;
  username: string;
  full_name: string;
  email: string;
  is_admin: boolean;
  is_active: boolean;
}

export const useProjectMembers = (projectId: number) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = () => localStorage.getItem('authToken');

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/projects/${projectId}/members`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setMembers(data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки участников');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchAllUsers = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      
      if (data.success) {
        setAllUsers(data.users || []);
      } else {
        setError(data.error || 'Ошибка загрузки пользователей');
      }
    } catch (err) {
      console.error('Ошибка загрузки пользователей:', err);
      setError(err instanceof Error ? err.message : 'Ошибка загрузки пользователей');
    }
  }, []);

  const addMember = useCallback(async (userId: number, role: string) => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/projects/${projectId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: userId, role }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchMembers();
        return true;
      } else {
        throw new Error(data.error || 'Ошибка добавления участника');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      return false;
    }
  }, [projectId, fetchMembers]);

  const updateMemberRole = useCallback(async (memberId: number, newRole: string) => {
    try {
      const token = getToken();
      const response = await fetch(
        `${API_BASE}/api/task-manager/projects/${projectId}/members/${memberId}/role`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ role: newRole }),
        }
      );

      const data = await response.json();
      if (data.success) {
        await fetchMembers();
        return true;
      } else {
        throw new Error(data.error || 'Ошибка изменения роли');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      return false;
    }
  }, [projectId, fetchMembers]);

  const removeMember = useCallback(async (memberId: number) => {
    try {
      const token = getToken();
      const response = await fetch(
        `${API_BASE}/api/task-manager/projects/${projectId}/members/${memberId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      const data = await response.json();
      if (data.success) {
        await fetchMembers();
        return true;
      } else {
        throw new Error(data.error || 'Ошибка удаления участника');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      return false;
    }
  }, [projectId, fetchMembers]);

  useEffect(() => {
    fetchMembers();
    fetchAllUsers();
  }, [fetchMembers, fetchAllUsers]);

  return {
    members,
    allUsers,
    loading,
    error,
    fetchMembers,
    addMember,
    updateMemberRole,
    removeMember,
  };
};

