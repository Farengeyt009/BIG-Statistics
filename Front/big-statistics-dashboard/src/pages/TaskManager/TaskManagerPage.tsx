import React, { useState, useEffect } from 'react';
import { ProjectsTableView } from './ProjectsTableView';
import { KanbanView } from './KanbanView';
import { ListView } from './ListView';
import { AttachmentsView } from './AttachmentsView';
import { ViewToggle } from './components/ViewToggle';
import { ProjectSettingsPage } from './ProjectSettingsPage';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { PageLayout } from '../../components/Layout';
import { WarningModal } from '../../components/WarningModal/WarningModal';

export const TaskManagerPage: React.FC = () => {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [viewType, setViewType] = useState<'list' | 'grid' | 'attachments'>('grid');
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>('member');
  const [projectName, setProjectName] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);

  useEffect(() => {
    setShowWarningModal(true);
  }, []);

  // Функция для обновления данных после изменений в настройках
  const handleSettingsChange = () => {
    setRefreshKey(prev => prev + 1);
  };

  // Загружаем роль и название проекта при выборе проекта
  React.useEffect(() => {
    if (selectedProjectId) {
      const fetchProjectData = async () => {
        try {
          const token = localStorage.getItem('authToken');
          const response = await fetch(`/api/task-manager/projects/${selectedProjectId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          const data = await response.json();
          if (data.success && data.data) {
            setCurrentUserRole(data.data.user_role || 'member');
            setProjectName(data.data.name || '');
          }
        } catch (err) {
          console.error('Ошибка загрузки данных проекта:', err);
        }
      };
      fetchProjectData();
    } else {
      setProjectName('');
    }
  }, [selectedProjectId]);

  if (selectedProjectId) {
    return (
      <PageLayout>
        <PageHeader
          title={projectName ? `BIG Task / ${projectName}` : "BIG Task"}
          view=""
          onViewChange={() => {}}
          tabs={[]}
          hideTabs={true}
        />

        {/* Контент */}
        <div className="h-[calc(100vh-200px)] overflow-hidden">
          {viewType === 'grid' ? (
            <KanbanView 
              projectId={selectedProjectId} 
              onBackToProjects={() => setSelectedProjectId(null)}
              onOpenSettings={() => setShowProjectSettings(true)}
              viewType={viewType}
              onViewTypeChange={setViewType}
              refreshKey={refreshKey}
            />
          ) : viewType === 'list' ? (
            <ListView 
              projectId={selectedProjectId} 
              onBackToProjects={() => setSelectedProjectId(null)}
              onOpenSettings={() => setShowProjectSettings(true)}
              viewType={viewType}
              onViewTypeChange={setViewType}
              refreshKey={refreshKey}
            />
          ) : (
            <AttachmentsView 
              projectId={selectedProjectId} 
              onBackToProjects={() => setSelectedProjectId(null)}
              onOpenSettings={() => setShowProjectSettings(true)}
              viewType={viewType}
              onViewTypeChange={setViewType}
              onTaskClick={(taskId) => setSelectedTaskId(taskId)}
            />
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
            onSettingsChange={handleSettingsChange}
          />
        )}

        <WarningModal
          isOpen={showWarningModal}
          onClose={() => setShowWarningModal(false)}
        />
      </PageLayout>
    );
  }

  return (
    <>
    <PageLayout>
      <PageHeader
        title="BIG Task"
        view="projects"
        onViewChange={() => {}} // Не нужно переключение на странице проектов
        tabs={[]} // Пустой массив, так как переключения нет
        hideTabs={true}
      />

      {/* Контент - только табличный вид */}
      <div className="h-[calc(100vh-200px)] overflow-hidden">
        <ProjectsTableView onProjectSelect={setSelectedProjectId} />
      </div>
    </PageLayout>

    <WarningModal
      isOpen={showWarningModal}
      onClose={() => setShowWarningModal(false)}
    />
    </>
  );
};

