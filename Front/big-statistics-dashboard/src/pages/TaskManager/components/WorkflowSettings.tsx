import React, { useState, useEffect } from 'react';

interface WorkflowSettingsProps {
  projectId: number;
}

const API_BASE = '';

export const WorkflowSettings: React.FC<WorkflowSettingsProps> = ({ projectId }) => {
  const [hasWorkflowPermissions, setHasWorkflowPermissions] = useState(false);
  const [loading, setLoading] = useState(false);

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
        console.error('Ошибка загрузки проекта:', err);
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
      console.error('Ошибка сохранения:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-blue-50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-900">Проверка прав на переходы</h4>
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
              hasWorkflowPermissions ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {hasWorkflowPermissions ? 'Включена' : 'Выключена'}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {hasWorkflowPermissions 
              ? 'Переходы между статусами разрешены только для указанных ролей/пользователей'
              : 'Любой участник может переводить задачи в любой статус (без ограничений)'}
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
          {hasWorkflowPermissions ? 'Выключить' : 'Включить'}
        </button>
      </div>
      
      {!hasWorkflowPermissions && (
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
          ⚠️ Настроенные переходы не будут проверяться пока не включите проверку прав
        </div>
      )}
    </div>
  );
};

