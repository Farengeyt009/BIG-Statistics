import React, { useState } from 'react';
import { ProjectsListPage } from './ProjectsListPage';
import { ProjectsTableView } from './ProjectsTableView';
import { KanbanView } from './KanbanView';
import { ListView } from './ListView';
import { ViewToggle } from './components/ViewToggle';
import { ProjectSettingsPage } from './ProjectSettingsPage';

export const TaskManagerPage: React.FC = () => {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [viewType, setViewType] = useState<'list' | 'grid'>('grid');
  const [projectsViewType, setProjectsViewType] = useState<'cards' | 'table'>('table');
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>('member');

  // Загружаем роль при выборе проекта
  React.useEffect(() => {
    if (selectedProjectId) {
      const fetchRole = async () => {
        try {
          const token = localStorage.getItem('authToken');
          const response = await fetch(`/api/task-manager/projects/${selectedProjectId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          const data = await response.json();
          if (data.success && data.data) {
            setCurrentUserRole(data.data.user_role || 'member');
          }
        } catch (err) {
          console.error('Ошибка загрузки роли:', err);
        }
      };
      fetchRole();
    }
  }, [selectedProjectId]);

  if (selectedProjectId) {
    return (
      <div className="h-screen flex flex-col">
        {/* Header с кнопками */}
        <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
          <button
            onClick={() => setSelectedProjectId(null)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Назад к проектам
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowProjectSettings(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              title="Настройки проекта"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Настройки
            </button>
            <ViewToggle view={viewType} onChange={setViewType} />
          </div>
        </div>

        {/* Контент */}
        <div className="flex-1 overflow-hidden">
          {viewType === 'grid' ? (
            <KanbanView projectId={selectedProjectId} />
          ) : (
            <ListView projectId={selectedProjectId} />
          )}
        </div>

        {/* Модалка настроек проекта */}
        {showProjectSettings && (
          <ProjectSettingsPage
            projectId={selectedProjectId}
            userRole={currentUserRole}
            onClose={() => setShowProjectSettings(false)}
            onProjectDeleted={() => {
              setShowProjectSettings(false);
              setSelectedProjectId(null);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header для списка проектов */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-900">Task Manager</h1>
        
        {/* Переключатель вида проектов */}
        <div className="inline-flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => setProjectsViewType('table')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              projectsViewType === 'table'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Таблица"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={() => setProjectsViewType('cards')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              projectsViewType === 'cards'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Карточки"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Контент */}
      <div className="flex-1 overflow-hidden">
        {projectsViewType === 'table' ? (
          <ProjectsTableView onProjectSelect={setSelectedProjectId} />
        ) : (
          <ProjectsListPage onProjectSelect={setSelectedProjectId} />
        )}
      </div>
    </div>
  );
};

