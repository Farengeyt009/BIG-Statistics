import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AssigneeSelector } from './AssigneeSelector';
import TaskManagerTranslation from '../TaskManagerTranslation.json';

interface DefaultAssigneesSettingsProps {
  projectId: number;
}

const API_BASE = '';

export const DefaultAssigneesSettings: React.FC<DefaultAssigneesSettingsProps> = ({ projectId }) => {
  const { t, i18n } = useTranslation('taskManager');
  const [defaultAssignee, setDefaultAssignee] = useState<number | null>(null);
  const [defaultSubtaskAssignee, setDefaultSubtaskAssignee] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load translations for Task Manager
  React.useEffect(() => {
    const currentLang = i18n.language;
    if (TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(currentLang, 'taskManager', TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);

  const getToken = () => localStorage.getItem('authToken');

  // Загрузка текущих настроек
  useEffect(() => {
    const fetchProject = async () => {
      try {
        const token = getToken();
        const response = await fetch(`${API_BASE}/api/task-manager/projects/${projectId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await response.json();
        if (data.success && data.data) {
          setDefaultAssignee(data.data.default_assignee_id || null);
          setDefaultSubtaskAssignee(data.data.default_subtask_assignee_id || null);
        }
      } catch (err) {
        console.error(t('validation.loadingError'), err);
      }
    };
    fetchProject();
  }, [projectId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          default_assignee_id: defaultAssignee,
          default_subtask_assignee_id: defaultSubtaskAssignee,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert(t('defaultAssigneesSettingsSaved'));
      }
    } catch (err) {
      console.error(t('validation.loadingError'), err);
      alert(t('validation.saveSettingsError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('defaultAssigneesTitle')}</h3>
      <p className="text-sm text-gray-600 mb-6">
        {t('defaultAssigneesDescription')}
      </p>

      <div className="space-y-6 max-w-md">
        {/* Исполнитель для основных задач */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('defaultAssigneesMainTask')}
          </label>
          <AssigneeSelector
            projectId={projectId}
            assigneeId={defaultAssignee || undefined}
            assigneeName={undefined}
            onUpdate={setDefaultAssignee}
          />
          <p className="text-xs text-gray-500 mt-1">
            {t('defaultAssigneesMainTaskDesc')}
          </p>
        </div>

        {/* Исполнитель для подзадач */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('defaultAssigneesSubtask')}
          </label>
          <AssigneeSelector
            projectId={projectId}
            assigneeId={defaultSubtaskAssignee || undefined}
            assigneeName={undefined}
            onUpdate={setDefaultSubtaskAssignee}
          />
          <p className="text-xs text-gray-500 mt-1">
            {t('defaultAssigneesSubtaskDesc')}
          </p>
        </div>

        {/* Кнопка сохранения */}
        <div className="pt-4 border-t">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {isSaving ? t('defaultAssigneesSaving') : t('defaultAssigneesSaveSettings')}
          </button>
        </div>
      </div>
    </div>
  );
};

