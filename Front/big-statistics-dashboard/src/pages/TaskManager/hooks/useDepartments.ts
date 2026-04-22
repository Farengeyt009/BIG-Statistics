import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchJsonGetDedup } from '../../../utils/fetchDedup';

export interface Department {
  id: number;
  name: string;
  name_en: string | null;
  name_zh: string | null;
  code: string | null;
  is_active: boolean;
  sort_order: number;
}

export const useDepartments = () => {
  const { i18n } = useTranslation();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const data = await fetchJsonGetDedup<{ success: boolean; departments?: Department[] }>(
        '/api/departments',
        token,
        60000
      );
      if (data.success) setDepartments(data.departments || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

  const getDeptName = useCallback(
    (dept: Department) => {
      const lang = i18n.language;
      if (lang === 'zh' && dept.name_zh) return dept.name_zh;
      if (lang === 'en' && dept.name_en) return dept.name_en;
      return dept.name;
    },
    [i18n.language]
  );

  return { departments, loading, getDeptName };
};
