import React, { useState, useEffect } from 'react';
import { AssigneeSelector } from './AssigneeSelector';
import { useProjectMembers } from '../hooks/useProjectMembers';

interface GeneralSettingsProps {
  projectId: number;
  userRole: string;
  onProjectDeleted: () => void;
}

const API_BASE = '';

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({ projectId, userRole, onProjectDeleted }) => {
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [ownerName, setOwnerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { members } = useProjectMembers(projectId);

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
        alert('Настройки сохранены');
      } else {
        alert(data.error || 'Ошибка сохранения');
      }
    } catch (err) {
      console.error('Ошибка:', err);
      alert('Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTransferOwnership = async (newOwnerId: number | null) => {
    if (!newOwnerId) return;

    if (!confirm('Передать права владельца? Вы потеряете полный контроль над проектом.')) {
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
        alert('Права владельца переданы');
        window.location.reload();
      } else {
        alert(data.error || 'Ошибка передачи прав');
      }
    } catch (err) {
      console.error('Ошибка:', err);
      alert('Ошибка передачи прав');
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm('Удалить проект? Все задачи, комментарии и файлы будут потеряны безвозвратно!')) {
      return;
    }

    if (!confirm('ЭТО НЕОБРАТИМО! Вы точно уверены?')) {
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
        alert(data.error || 'Ошибка удаления');
      }
    } catch (err) {
      console.error('Ошибка:', err);
      alert('Ошибка удаления проекта');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Название */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Название проекта
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
          Описание
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
          {isSaving ? 'Сохранение...' : 'Сохранить изменения'}
        </button>
      </div>

      {/* Владелец (только для owner) */}
      {userRole === 'owner' && (
        <div className="pt-6 border-t">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Владелец проекта</h3>
          <p className="text-sm text-gray-600 mb-3">
            Текущий владелец: <span className="font-medium">{ownerName}</span>
          </p>
          
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Передать права новому владельцу:
            </label>
            <AssigneeSelector
              projectId={projectId}
              assigneeId={undefined}
              assigneeName={undefined}
              onUpdate={handleTransferOwnership}
            />
          </div>
          <p className="text-xs text-yellow-600 bg-yellow-50 p-3 rounded">
            ⚠️ После передачи прав вы станете администратором проекта
          </p>
        </div>
      )}

      {/* Опасная зона (только для owner) */}
      {userRole === 'owner' && (
        <div className="pt-6 border-t border-red-200">
          <h3 className="text-lg font-semibold text-red-600 mb-4">Опасная зона</h3>
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Удалить проект</h4>
            <p className="text-sm text-gray-600 mb-3">
              Удаление проекта безвозвратно. Все задачи, комментарии, файлы и история будут потеряны.
            </p>
            <button
              onClick={handleDeleteProject}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Удалить проект
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

