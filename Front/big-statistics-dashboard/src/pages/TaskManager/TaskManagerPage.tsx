import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ProjectsTableView } from './ProjectsTableView';
import { KanbanView } from './KanbanView';
import { ListView } from './ListView';
import { TableView } from './TableView';
import { AttachmentsView } from './AttachmentsView';
import { OverviewView } from './OverviewView';
import { ProjectSettingsPage } from './ProjectSettingsPage';
import { ProjectToolbar, ViewType } from './components/ProjectToolbar';
import { FilterBar } from './components/FilterBar';
import { SortOption } from './components/SortSelector';
import { TaskFilters, EMPTY_FILTERS, countActiveFilters } from './types/filters';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { PageLayout } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { fetchJsonGetDedup } from '../../utils/fetchDedup';

export const TaskManagerPage: React.FC = () => {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [viewType, setViewType] = useState<ViewType>('board');
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>('member');
  const [projectName, setProjectName] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [createTrigger, setCreateTrigger] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>('priority');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  const handleSettingsChange = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleOpenProject = (projectId: number) => {
    // Always open project on Board view.
    setViewType('board');
    setShowProjectSettings(false);
    setSelectedProjectId(projectId);
  };

  const handleBackToProjects = () => {
    setShowProjectSettings(false);
    setSelectedProjectId(null);
  };

  const handleExport = async (selectedIds?: number[]) => {
    if (!selectedProjectId) return;
    try {
      const token = localStorage.getItem('authToken');
      const lang = i18n.language?.slice(0, 2) || 'ru';

      const params = new URLSearchParams({ lang });

      // Если есть выделенные задачи — выгружаем только их (фильтры не нужны)
      if (selectedIds && selectedIds.length > 0) {
        params.set('task_ids', selectedIds.join(','));
      } else {
        // Иначе применяем активные фильтры
        if (filters.statuses.length > 0) params.set('status_ids', filters.statuses.join(','));
        if (filters.priorities.length > 0) params.set('priorities', filters.priorities.join(','));
        if (filters.assigneeIds.length > 0) {
          const nums = filters.assigneeIds.filter(id => id !== 'unassigned').join(',');
          const hasUnassigned = filters.assigneeIds.includes('unassigned');
          if (nums) params.set('assignee_ids', nums);
          if (hasUnassigned) params.set('include_unassigned', '1');
        }
      }

      const res = await fetch(`/api/task-manager/tasks/project/${selectedProjectId}/export?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tasks_${projectName || selectedProjectId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Ошибка экспорта:', err);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      const fetchProjectData = async () => {
        try {
          const token = localStorage.getItem('authToken');
          const data = await fetchJsonGetDedup<any>(
            `/api/task-manager/projects/${selectedProjectId}`,
            token,
            1000
          );
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
          title="BIG Task"
          view=""
          onViewChange={() => {}}
          tabs={[]}
          hideTabs={true}
        />

        <div className="h-[calc(100vh-120px)] overflow-hidden flex flex-col">
          <ProjectToolbar
            projectName={projectName}
            viewType={viewType}
            onViewTypeChange={(v) => { setViewType(v); setShowProjectSettings(false); }}
            onBackToProjects={handleBackToProjects}
            onOpenSettings={() => setShowProjectSettings(prev => !prev)}
            onCreateTask={() => setCreateTrigger(t => t + 1)}
            sortBy={sortBy}
            onSortChange={setSortBy}
            hideCompleted={hideCompleted}
            onHideCompletedChange={setHideCompleted}
            canManage={user?.is_admin || ['owner', 'admin'].includes(currentUserRole)}
            settingsActive={showProjectSettings}
            filterCount={countActiveFilters(filters)}
            filterActive={showFilters}
            onFilterToggle={() => setShowFilters(p => !p)}
            onExport={() => handleExport()}
          />

          {showFilters && !showProjectSettings && viewType !== 'files' && viewType !== 'overview' && (
            <FilterBar
              projectId={selectedProjectId}
              filters={filters}
              onChange={setFilters}
            />
          )}

          <div className="flex-1 overflow-hidden relative">
            {showProjectSettings ? (
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
            ) : (
              <>
                {viewType === 'overview' && (
                  <OverviewView
                    projectId={selectedProjectId}
                    onMemberClick={(memberId) => {
                      setFilters({
                        ...EMPTY_FILTERS,
                        assigneeIds: [memberId],
                      });
                      setViewType('table');
                      setShowFilters(true);
                    }}
                  />
                )}
                {viewType === 'board' && (
                  <KanbanView
                    projectId={selectedProjectId}
                    refreshKey={refreshKey}
                    createTrigger={createTrigger}
                    sortBy={sortBy}
                    hideCompleted={hideCompleted}
                    filters={filters}
                  />
                )}
                {viewType === 'list' && (
                  <ListView
                    projectId={selectedProjectId}
                    refreshKey={refreshKey}
                    createTrigger={createTrigger}
                    sortBy={sortBy}
                    hideCompleted={hideCompleted}
                    userRole={currentUserRole}
                    filters={filters}
                    onExport={handleExport}
                  />
                )}
                {viewType === 'table' && (
                  <TableView
                    projectId={selectedProjectId}
                    refreshKey={refreshKey}
                    createTrigger={createTrigger}
                    sortBy={sortBy}
                    hideCompleted={hideCompleted}
                    userRole={currentUserRole}
                    filters={filters}
                    onExport={handleExport}
                  />
                )}
                {viewType === 'files' && (
                  <AttachmentsView
                    projectId={selectedProjectId}
                  />
                )}
              </>
            )}
          </div>
        </div>

      </PageLayout>
    );
  }

  return (
    <>
      <PageLayout>
        <PageHeader
          title="BIG Task"
          view="projects"
          onViewChange={() => {}}
          tabs={[]}
          hideTabs={true}
        />

        <div className="h-[calc(100vh-120px)] overflow-hidden">
          <ProjectsTableView onProjectSelect={handleOpenProject} />
        </div>
      </PageLayout>

    </>
  );
};
