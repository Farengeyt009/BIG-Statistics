import { useState, useEffect, useCallback } from 'react';

const API_BASE = '';
const CUSTOM_FIELDS_CACHE_TTL_MS = 10000;
const TASK_FIELD_VALUES_CACHE_TTL_MS = 7000;

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

const customFieldsCache = new Map<string, { data: CustomField[]; ts: number }>();
const customFieldsInFlight = new Map<string, Promise<CustomField[]>>();

export const useCustomFields = (projectId: number) => {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(false);

  const getToken = () => localStorage.getItem('authToken');

  const recordPerf = (_op: string, _ms: number, _status?: number) => {};

  const fetchFields = useCallback(async (activeOnly = false) => {
    if (projectId === 0) return; // нет проекта — пропускаем запрос
    setLoading(true);
    try {
      const cacheKey = `${projectId}:${activeOnly ? 1 : 0}`;
      const now = Date.now();
      const cached = customFieldsCache.get(cacheKey);
      if (cached && now - cached.ts < CUSTOM_FIELDS_CACHE_TTL_MS) {
        setFields(cached.data);
        return;
      }

      const inFlight = customFieldsInFlight.get(cacheKey);
      if (inFlight) {
        const sharedData = await inFlight;
        setFields(sharedData);
        return;
      }

      const token = getToken();
      const started = performance.now();
      const requestPromise = fetch(
        `${API_BASE}/api/task-manager/custom-fields/project/${projectId}?active_only=${activeOnly}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      ).then(async (response) => {
        recordPerf('fetchCustomFields', performance.now() - started, response.status);
        const payload = await response.json();
        if (!payload.success) return [] as CustomField[];
        return payload.data as CustomField[];
      });

      customFieldsInFlight.set(cacheKey, requestPromise);
      const data = await requestPromise;
      customFieldsInFlight.delete(cacheKey);
      customFieldsCache.set(cacheKey, { data, ts: Date.now() });
      setFields(data);
    } catch (err) {
      const cacheKey = `${projectId}:${activeOnly ? 1 : 0}`;
      customFieldsInFlight.delete(cacheKey);
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

// Hook для работы со значениями полей задачи (multi-row)
export interface FieldDefinition {
  field_id: number;
  field_name: string;
  field_type: string;
  field_options?: string;
  is_required: boolean;
}

export interface FieldRow {
  row_index: number;
  values: Record<number, string>;
}

export interface TaskFieldData {
  fields: FieldDefinition[];
  rows: FieldRow[];
}

const taskFieldValuesCache = new Map<number, { data: TaskFieldData; ts: number }>();
const taskFieldValuesInFlight = new Map<number, Promise<TaskFieldData>>();

export const useTaskFieldValues = (taskId: number) => {
  const [fieldData, setFieldData] = useState<TaskFieldData>({ fields: [], rows: [] });
  const [loading, setLoading] = useState(false);

  const getToken = () => localStorage.getItem('authToken');

  const recordPerf = (_op: string, _ms: number, _status?: number) => {};

  const fetchFieldValues = useCallback(async () => {
    if (taskId === 0) return; // create mode — нет задачи, пропускаем запрос
    setLoading(true);
    try {
      const now = Date.now();
      const cached = taskFieldValuesCache.get(taskId);
      if (cached && now - cached.ts < TASK_FIELD_VALUES_CACHE_TTL_MS) {
        setFieldData(cached.data);
        return;
      }

      const inFlight = taskFieldValuesInFlight.get(taskId);
      if (inFlight) {
        const sharedData = await inFlight;
        setFieldData(sharedData);
        return;
      }

      const token = getToken();
      const started = performance.now();
      const requestPromise = fetch(
        `${API_BASE}/api/task-manager/custom-fields/task/${taskId}/values`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      ).then(async (response) => {
        recordPerf('fetchTaskFieldValues', performance.now() - started, response.status);
        const payload = await response.json();
        if (!payload.success) {
          throw new Error(payload.error || 'Ошибка загрузки значений');
        }
        return payload.data as TaskFieldData;
      });

      taskFieldValuesInFlight.set(taskId, requestPromise);
      const data = await requestPromise;
      taskFieldValuesInFlight.delete(taskId);
      taskFieldValuesCache.set(taskId, { data, ts: Date.now() });
      setFieldData(data);
    } catch (err) {
      taskFieldValuesInFlight.delete(taskId);
      console.error('Ошибка загрузки значений:', err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const saveRows = useCallback(async (rows: FieldRow[]) => {
    try {
      const token = getToken();
      const started = performance.now();
      const response = await fetch(
        `${API_BASE}/api/task-manager/custom-fields/task/${taskId}/rows`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ rows }),
        }
      );
      recordPerf('saveTaskFieldRows', performance.now() - started, response.status);
      const data = await response.json();
      if (data.success) {
        taskFieldValuesCache.set(taskId, {
          data: {
            fields: fieldData.fields,
            rows,
          },
          ts: Date.now(),
        });
      }
      return data.success;
    } catch (err) {
      console.error('Ошибка сохранения строк:', err);
      return false;
    }
  }, [taskId, fieldData.fields]);

  useEffect(() => {
    fetchFieldValues();
  }, [fetchFieldValues]);

  // Обратная совместимость — плоский список полей для валидации в TaskDetailsModal
  const fieldValues = fieldData.fields;

  return {
    fieldData,
    fieldValues,
    loading,
    fetchFieldValues,
    saveRows,
  };
};

