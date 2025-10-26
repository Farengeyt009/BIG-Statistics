import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import TaskManagerTranslation from '../TaskManagerTranslation.json';

interface WorkflowSettingsProps {
  projectId: number;
}

const API_BASE = '';

export const WorkflowSettings: React.FC<WorkflowSettingsProps> = ({ projectId }) => {
  const { t, i18n } = useTranslation('taskManager');
  const [hasWorkflowPermissions, setHasWorkflowPermissions] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load translations for Task Manager
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
        const response = await fetch(`${API_BASE}/api/task-manager/projects/${projectId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await response.json();
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
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/api/task-manager/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ has_workflow_permissions: !hasWorkflowPermissions }),
      });

      const data = await response.json();
      if (data.success) {
        setHasWorkflowPermissions(!hasWorkflowPermissions);
      }
    } catch (err) {
      console.error(t('workflowSettingsSaveError'), err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-blue-50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-900">{t('workflowSettingsTitle')}</h4>
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
              hasWorkflowPermissions ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {hasWorkflowPermissions ? t('workflowSettingsEnabled') : t('workflowSettingsDisabled')}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {hasWorkflowPermissions 
              ? t('workflowSettingsEnabledDesc')
              : t('workflowSettingsDisabledDesc')}
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={loading}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            hasWorkflowPermissions
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-green-600 text-white hover:bg-green-700'
          } disabled:opacity-50`}
        >
          {hasWorkflowPermissions ? t('workflowSettingsDisable') : t('workflowSettingsEnable')}
        </button>
      </div>
      
      {!hasWorkflowPermissions && (
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
          {t('workflowSettingsWarning')}
        </div>
      )}
    </div>
  );
};

