import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import TaskManagerTranslation from '../TaskManagerTranslation.json';
import { fetchJsonGetDedup, invalidateGetDedup } from '../../../utils/fetchDedup';

interface WorkflowSettingsProps {
  projectId: number;
}

const API_BASE = '';

export const WorkflowSettings: React.FC<WorkflowSettingsProps> = ({ projectId }) => {
  const { t, i18n } = useTranslation('taskManager');
  const [hasWorkflowPermissions, setHasWorkflowPermissions] = useState(false);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    const currentLang = i18n.language;
    if (TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(currentLang, 'taskManager', TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const data = await fetchJsonGetDedup<any>(
          `${API_BASE}/api/task-manager/projects/${projectId}`,
          token,
          1000
        );
        if (data.success && data.data) {
          setHasWorkflowPermissions(data.data.has_workflow_permissions || false);
        }
      } catch (err) {
        console.error(t('workflowSettingsLoadingError'), err);
      }
    };
    fetchProject();
  }, [projectId]);

  const handleToggle = async () => {
    setLoading(true);
    const next = !hasWorkflowPermissions;
    setHasWorkflowPermissions(next);
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/api/task-manager/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ has_workflow_permissions: next }),
      });
      const data = await response.json();
      if (!data.success) {
        setHasWorkflowPermissions(!next);
      } else {
        invalidateGetDedup(`${API_BASE}/api/task-manager/projects/${projectId}`, token);
      }
    } catch {
      setHasWorkflowPermissions(!next);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-xl flex items-center justify-between py-2.5 px-4 border border-gray-200 rounded-xl bg-white">
      <div>
        <span className="text-sm font-medium text-gray-800">{t('workflowSettingsToggleLabel')}</span>
        <p className="text-xs text-gray-400 mt-0.5">
          {hasWorkflowPermissions ? t('workflowSettingsEnabledDesc') : t('workflowSettingsDisabledDesc')}
        </p>
      </div>
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
          hasWorkflowPermissions ? 'bg-blue-600' : 'bg-gray-200'
        }`}
        role="switch"
        aria-checked={hasWorkflowPermissions}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
            hasWorkflowPermissions ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      </div>
    </div>
  );
};
