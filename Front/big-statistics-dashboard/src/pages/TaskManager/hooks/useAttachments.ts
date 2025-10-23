import { useState, useEffect, useCallback } from 'react';

const API_BASE = '';

interface Attachment {
  id: number;
  task_id: number;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_by: number;
  uploaded_by_name: string;
  uploaded_at: string;
}

export const useAttachments = (taskId: number) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = () => localStorage.getItem('authToken');

  const fetchAttachments = useCallback(async (onCountUpdate?: (count: number) => void) => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/attachments/task/${taskId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setAttachments(data.data);
        // Уведомляем о количестве
        if (onCountUpdate) {
          onCountUpdate(data.data.length);
        }
      } else {
        throw new Error(data.error || 'Ошибка загрузки файлов');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const token = getToken();
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE}/api/task-manager/attachments/task/${taskId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        await fetchAttachments();
        return true;
      } else {
        throw new Error(data.error || 'Ошибка загрузки файла');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      return false;
    } finally {
      setUploading(false);
    }
  }, [taskId, fetchAttachments]);

  const downloadFile = useCallback((attachmentId: number, fileName: string) => {
    const token = getToken();
    const url = `${API_BASE}/api/task-manager/attachments/${attachmentId}/download`;
    
    // Создаем временную ссылку для скачивания
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    
    // Добавляем токен через fetch для авторизации
    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then((response) => response.blob())
      .then((blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        link.href = blobUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      })
      .catch((err) => {
        console.error('Ошибка скачивания:', err);
        setError('Ошибка скачивания файла');
      });
  }, []);

  const deleteAttachment = useCallback(async (attachmentId: number) => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/attachments/${attachmentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        await fetchAttachments();
        return true;
      } else {
        throw new Error(data.error || 'Ошибка удаления файла');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      return false;
    }
  }, [fetchAttachments]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  // Экспортируем текущее количество
  useEffect(() => {
    // Можно добавить callback для уведомления об изменениях
  }, [attachments.length]);

  return {
    attachments,
    loading,
    uploading,
    error,
    fetchAttachments,
    uploadFile,
    downloadFile,
    deleteAttachment,
  };
};

