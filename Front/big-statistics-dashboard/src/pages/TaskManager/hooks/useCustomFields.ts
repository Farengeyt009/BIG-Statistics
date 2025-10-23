import { useState, useEffect, useCallback } from 'react';

const API_BASE = '';

interface CustomField {
  id: number;
  project_id: number;
  field_name: string;
  field_type: 'text' | 'number' | 'date' | 'select' | 'checkbox';
  field_options?: string; // JSON string
  is_required: boolean;
  is_active: boolean;
  order_index: number;
}

interface FieldValue {
  field_id: number;
  field_name: string;
  field_type: string;
  field_options?: string;
  is_required: boolean;
  value: string;
  value_id?: number;
}

export const useCustomFields = (projectId: number) => {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(false);

  const getToken = () => localStorage.getItem('authToken');

  const fetchFields = useCallback(async (activeOnly = false) => {
    setLoading(true);
    try {
      const token = getToken();
      const response = await fetch(
        `${API_BASE}/api/task-manager/custom-fields/project/${projectId}?active_only=${activeOnly}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      const data = await response.json();
      if (data.success) {
        setFields(data.data);
      }
    } catch (err) {
      console.error('Ошибка загрузки полей:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const createField = useCallback(async (fieldData: {
    field_name: string;
    field_type: string;
    field_options?: string;
    is_required?: boolean;
  }) => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/custom-fields/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ ...fieldData, project_id: projectId }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchFields();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Ошибка создания поля:', err);
      return false;
    }
  }, [projectId, fetchFields]);

  const updateField = useCallback(async (fieldId: number, updates: any) => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/custom-fields/${fieldId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();
      if (data.success) {
        await fetchFields();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Ошибка обновления поля:', err);
      return false;
    }
  }, [fetchFields]);

  const deleteField = useCallback(async (fieldId: number) => {
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/custom-fields/${fieldId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        await fetchFields();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Ошибка удаления поля:', err);
      return false;
    }
  }, [fetchFields]);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  return {
    fields,
    loading,
    fetchFields,
    createField,
    updateField,
    deleteField,
  };
};

// Hook для работы со значениями полей задачи
export const useTaskFieldValues = (taskId: number) => {
  const [fieldValues, setFieldValues] = useState<FieldValue[]>([]);
  const [loading, setLoading] = useState(false);

  const getToken = () => localStorage.getItem('authToken');

  const fetchFieldValues = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      const response = await fetch(
        `${API_BASE}/api/task-manager/custom-fields/task/${taskId}/values`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      const data = await response.json();
      if (data.success) {
        setFieldValues(data.data);
      }
    } catch (err) {
      console.error('Ошибка загрузки значений:', err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const setFieldValue = useCallback(async (fieldId: number, value: string) => {
    try {
      const token = getToken();
      const response = await fetch(
        `${API_BASE}/api/task-manager/custom-fields/task/${taskId}/values`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ field_id: fieldId, value }),
        }
      );

      const data = await response.json();
      if (data.success) {
        await fetchFieldValues();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Ошибка сохранения значения:', err);
      return false;
    }
  }, [taskId, fetchFieldValues]);

  useEffect(() => {
    fetchFieldValues();
  }, [fetchFieldValues]);

  return {
    fieldValues,
    loading,
    fetchFieldValues,
    setFieldValue,
  };
};

