import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AssigneeSelector } from './AssigneeSelector';
import TaskManagerTranslation from '../TaskManagerTranslation.json';
import { fetchJsonGetDedup, invalidateGetDedup } from '../../../utils/fetchDedup';

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
        const data = await fetchJsonGetDedup<any>(
          `${API_BASE}/api/task-manager/projects/${projectId}`,
          token,
          1000
        );
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
        invalidateGetDedup(`${API_BASE}/api/task-manager/projects/${projectId}`, token);
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
    <div className="flex justify-center">
      <div className="w-full max-w-xl space-y-3">

        {/* Assignees card */}
        <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-700">{t('defaultAssigneesTitle')}</span>
          </div>
          <div className="divide-y divide-gray-100">

            {/* Main task assignee */}
            <div className="px-4 py-3.5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800">{t('defaultAssigneesMainTask')}</div>
                <div className="text-xs text-gray-400 mt-0.5">{t('defaultAssigneesMainTaskDesc')}</div>
              </div>
              <div className="shrink-0 w-48">
                <AssigneeSelector
                  projectId={projectId}
                  assigneeId={defaultAssignee || undefined}
                  assigneeName={undefined}
                  onUpdate={setDefaultAssignee}
                />
              </div>
            </div>

            {/* Subtask assignee */}
            <div className="px-4 py-3.5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800">{t('defaultAssigneesSubtask')}</div>
                <div className="text-xs text-gray-400 mt-0.5">{t('defaultAssigneesSubtaskDesc')}</div>
              </div>
              <div className="shrink-0 w-48">
                <AssigneeSelector
                  projectId={projectId}
                  assigneeId={defaultSubtaskAssignee || undefined}
                  assigneeName={undefined}
                  onUpdate={setDefaultSubtaskAssignee}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSaving ? t('defaultAssigneesSaving') : t('defaultAssigneesSaveSettings')}
          </button>
        </div>
      </div>
    </div>
  );
};

