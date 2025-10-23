import React, { useState, useEffect } from 'react';
import { AssigneeSelector } from './AssigneeSelector';

interface DefaultAssigneesSettingsProps {
  projectId: number;
}

const API_BASE = '';

export const DefaultAssigneesSettings: React.FC<DefaultAssigneesSettingsProps> = ({ projectId }) => {
  const [defaultAssignee, setDefaultAssignee] = useState<number | null>(null);
  const [defaultSubtaskAssignee, setDefaultSubtaskAssignee] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
        console.error('Ошибка загрузки настроек:', err);
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
        alert('Настройки сохранены');
      }
    } catch (err) {
      console.error('Ошибка сохранения:', err);
      alert('Ошибка сохранения настроек');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Исполнители по умолчанию</h3>
      <p className="text-sm text-gray-600 mb-6">
        Укажите участников, которые будут автоматически назначаться при создании новых задач
      </p>

      <div className="space-y-6 max-w-md">
        {/* Исполнитель для основных задач */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Исполнитель для новых задач
          </label>
          <AssigneeSelector
            projectId={projectId}
            assigneeId={defaultAssignee || undefined}
            assigneeName={undefined}
            onUpdate={setDefaultAssignee}
          />
          <p className="text-xs text-gray-500 mt-1">
            Будет автоматически назначаться при создании задачи
          </p>
        </div>

        {/* Исполнитель для подзадач */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Исполнитель для новых подзадач
          </label>
          <AssigneeSelector
            projectId={projectId}
            assigneeId={defaultSubtaskAssignee || undefined}
            assigneeName={undefined}
            onUpdate={setDefaultSubtaskAssignee}
          />
          <p className="text-xs text-gray-500 mt-1">
            Будет автоматически назначаться при создании подзадачи
          </p>
        </div>

        {/* Кнопка сохранения */}
        <div className="pt-4 border-t">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {isSaving ? 'Сохранение...' : 'Сохранить настройки'}
          </button>
        </div>
      </div>
    </div>
  );
};

