import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AssigneeSelector } from './AssigneeSelector';
import { useProjectMembers } from '../hooks/useProjectMembers';
import TaskManagerTranslation from '../TaskManagerTranslation.json';

interface GeneralSettingsProps {
  projectId: number;
  userRole: string;
  onProjectDeleted: () => void;
}

const API_BASE = '';

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({ projectId, userRole, onProjectDeleted }) => {
  const { t, i18n } = useTranslation('taskManager');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [ownerName, setOwnerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { members } = useProjectMembers(projectId);

  // Load translations for Task Manager
  React.useEffect(() => {
    const currentLang = i18n.language;
    if (TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(currentLang, 'taskManager', TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);

  const getToken = () => localStorage.getItem('authToken');

  useEffect(() => {
    const fetchProject = async () => {
      setLoading(true);
      try {
        const token = getToken();
        const response = await fetch(`${API_BASE}/api/task-manager/projects/${projectId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        const data = await response.json();
        if (data.success && data.data) {
          setProjectName(data.data.name || '');
          setProjectDescription(data.data.description || '');
          setOwnerId(data.data.owner_id);
          setOwnerName(data.data.owner_name || '');
        }
      } catch (err) {
        console.error('Ошибка загрузки проекта:', err);
      } finally {
        setLoading(false);
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
          name: projectName,
          description: projectDescription,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert(t('generalSettingsSettingsSaved'));
      } else {
        alert(data.error || t('generalSettingsSaveError'));
      }
    } catch (err) {
      console.error('Ошибка:', err);
      alert(t('generalSettingsSaveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTransferOwnership = async (newOwnerId: number | null) => {
    if (!newOwnerId) return;

    if (!confirm(t('generalSettingsTransferConfirm'))) {
      return;
    }

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/projects/${projectId}/transfer-ownership`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ new_owner_id: newOwnerId }),
      });

      const data = await response.json();
      if (data.success) {
        alert(t('generalSettingsTransferSuccess'));
        window.location.reload();
      } else {
        alert(data.error || t('generalSettingsTransferError'));
      }
    } catch (err) {
      console.error('Ошибка:', err);
      alert(t('generalSettingsTransferError'));
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm(t('generalSettingsDeleteConfirm'))) {
      return;
    }

    if (!confirm(t('generalSettingsDeleteConfirmFinal'))) {
      return;
    }

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/projects/${projectId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        onProjectDeleted();
      } else {
        alert(data.error || t('generalSettingsDeleteError'));
      }
    } catch (err) {
      console.error('Ошибка:', err);
      alert(t('generalSettingsDeleteProjectError'));
    }
  };

  if (loading) {
    return <div className="text-center py-8">{t('generalSettingsLoading')}</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Название */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('generalSettingsProjectName')}
        </label>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Описание */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('generalSettingsDescription')}
        </label>
        <textarea
          value={projectDescription}
          onChange={(e) => setProjectDescription(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
          rows={4}
        />
      </div>

      {/* Кнопка сохранения */}
      <div className="pt-4 border-t">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? t('generalSettingsSaving') : t('generalSettingsSaveChanges')}
        </button>
      </div>

      {/* Владелец (только для owner) */}
      {userRole === 'owner' && (
        <div className="pt-6 border-t">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('generalSettingsProjectOwner')}</h3>
          <p className="text-sm text-gray-600 mb-3">
            {t('generalSettingsCurrentOwner')} <span className="font-medium">{ownerName}</span>
          </p>
          
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('generalSettingsTransferRights')}
            </label>
            <AssigneeSelector
              projectId={projectId}
              assigneeId={undefined}
              assigneeName={undefined}
              onUpdate={handleTransferOwnership}
            />
          </div>
          <p className="text-xs text-yellow-600 bg-yellow-50 p-3 rounded">
            ⚠️ {t('generalSettingsTransferWarning')}
          </p>
        </div>
      )}

      {/* Опасная зона (только для owner) */}
      {userRole === 'owner' && (
        <div className="pt-6 border-t border-red-200">
          <h3 className="text-lg font-semibold text-red-600 mb-4">{t('generalSettingsDangerZone')}</h3>
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">{t('generalSettingsDeleteProject')}</h4>
            <p className="text-sm text-gray-600 mb-3">
              {t('generalSettingsDeleteWarning')}
            </p>
            <button
              onClick={handleDeleteProject}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              {t('generalSettingsDeleteButton')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

