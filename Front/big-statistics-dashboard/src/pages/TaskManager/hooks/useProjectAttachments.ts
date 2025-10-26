import { useState, useEffect } from 'react';

export interface ProjectAttachment {
  id: number;
  task_id: number;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_by: number;
  uploaded_by_name: string;
  uploaded_at: string;
  task_title: string;
  task_created_at: string;
}

export const useProjectAttachments = (projectId: number | null) => {
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAttachments = async () => {
    if (!projectId) {
      setAttachments([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/task-manager/attachments/project/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setAttachments(data.data);
      } else {
        setError(data.error || 'Ошибка загрузки вложений');
      }
    } catch (err) {
      setError('Ошибка сети');
      console.error('Ошибка загрузки вложений:', err);
    } finally {
      setLoading(false);
    }
  };

  const downloadAttachment = async (attachmentId: number, fileName: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/task-manager/attachments/${attachmentId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        throw new Error('Ошибка скачивания файла');
      }
    } catch (err) {
      console.error('Ошибка скачивания файла:', err);
      throw err;
    }
  };

  const deleteAttachment = async (attachmentId: number) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/task-manager/attachments/${attachmentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        // Удаляем из локального состояния
        setAttachments(prev => prev.filter(att => att.id !== attachmentId));
        return true;
      } else {
        throw new Error(data.error || 'Ошибка удаления файла');
      }
    } catch (err) {
      console.error('Ошибка удаления файла:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchAttachments();
  }, [projectId]);

  return {
    attachments,
    loading,
    error,
    fetchAttachments,
    downloadAttachment,
    deleteAttachment,
  };
};
