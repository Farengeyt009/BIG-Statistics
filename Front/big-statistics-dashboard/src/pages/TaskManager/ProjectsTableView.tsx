import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjects } from './hooks/useProjects';
import { AvatarGroup } from './components/ui/Avatar';
import TaskManagerTranslation from './TaskManagerTranslation.json';

interface ProjectsTableViewProps {
  onProjectSelect: (projectId: number) => void;
}

export const ProjectsTableView: React.FC<ProjectsTableViewProps> = ({ onProjectSelect }) => {
  const { t, i18n } = useTranslation('taskManager');
  const { projects, loading, error, createProject, toggleFavorite } = useProjects();

  // Загружаем переводы для Task Manager
  React.useEffect(() => {
    const currentLang = i18n.language;
    if (TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(currentLang, 'taskManager', TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [nameFilter, setNameFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [tasksFilter, setTasksFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      alert(t('projectNameRequired'));
      return;
    }

    const success = await createProject({
      name: newProjectName,
      description: newProjectDescription,
    });

    if (success) {
      setShowCreateModal(false);
      setNewProjectName('');
      setNewProjectDescription('');
    }
  };

  const getRoleLabel = (role: string) => {
    if (role === 'owner') return t('projectSettingsOwner');
    if (role === 'admin') return t('projectSettingsAdmin');
    if (role === 'member') return t('projectSettingsMember');
    if (role === 'viewer') return t('projectSettingsViewer');
    return role;
  };

  const filteredProjects = useMemo(() => {
    const nameQ = nameFilter.trim().toLowerCase();
    const teamQ = teamFilter.trim().toLowerCase();
    const tasksQ = tasksFilter.trim().toLowerCase();
    const roleQ = roleFilter.trim().toLowerCase();

    return projects.filter((project) => {
      if (favoritesOnly && !project.is_favorite) return false;

      if (nameQ) {
        const nameMatch = (project.name || '').toLowerCase().includes(nameQ);
        const descMatch = (project.description || '').toLowerCase().includes(nameQ);
        if (!nameMatch && !descMatch) return false;
      }

      if (teamQ) {
        const ownerMatch = (project.owner_name || '').toLowerCase().includes(teamQ);
        const memberMatch = (project.members || []).some((m) =>
          ((m.full_name || '') + ' ' + (m.username || '')).toLowerCase().includes(teamQ)
        );
        if (!ownerMatch && !memberMatch) return false;
      }

      if (tasksQ && !String(project.task_count ?? 0).includes(tasksQ)) {
        return false;
      }

      if (roleQ) {
        const roleRaw = (project.user_role || '').toLowerCase();
        const roleTranslated = getRoleLabel(project.user_role || '').toLowerCase();
        if (!roleRaw.includes(roleQ) && !roleTranslated.includes(roleQ)) return false;
      }

      return true;
    });
  }, [projects, nameFilter, teamFilter, tasksFilter, roleFilter, favoritesOnly, t]);

  const resetFilters = () => {
    setNameFilter('');
    setTeamFilter('');
    setTasksFilter('');
    setRoleFilter('');
    setFavoritesOnly(false);
  };

  const activeFiltersCount =
    (nameFilter ? 1 : 0) +
    (teamFilter ? 1 : 0) +
    (tasksFilter ? 1 : 0) +
    (roleFilter ? 1 : 0) +
    (favoritesOnly ? 1 : 0);

  const handleToggleFavorite = async (projectId: number, nextFavorite: boolean) => {
    await toggleFavorite(projectId, nextFavorite);
  };

  return (
    <div className="p-6">
      {loading && projects.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">{t('loadingProjects')}</div>
        </div>
      ) : (
        <>
      {/* Заголовок */}
      <div className="flex justify-between items-center mb-4">
        <div className="relative">
          <button
            onClick={() => setShowFilterPanel((v) => !v)}
            className={`relative inline-flex items-center justify-center p-2 rounded-md border transition-colors ${
              showFilterPanel || activeFiltersCount > 0
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
            title={t('filterButton')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 01.8 1.6L14 13v6a1 1 0 01-1.447.894l-2-1A1 1 0 0110 18v-5L3.2 4.6A1 1 0 013 4z" />
            </svg>
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-semibold">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium"
        >
          {t('createProjectButton')}
        </button>
      </div>
      {showFilterPanel && (
        <div className="mb-4 p-3 bg-white border border-gray-200 rounded-lg">
          <div className="flex items-end gap-2 flex-wrap">
            <div className="w-44">
              <label className="block text-[11px] text-gray-500 mb-1">{t('projectName')}</label>
              <input
                type="text"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder={t('projectsSearchName')}
                className="w-full h-8 px-2 text-xs border border-gray-200 rounded"
              />
            </div>
            <div className="w-44">
              <label className="block text-[11px] text-gray-500 mb-1">{t('team')}</label>
              <input
                type="text"
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                placeholder={t('projectsSearchTeam')}
                className="w-full h-8 px-2 text-xs border border-gray-200 rounded"
              />
            </div>
            <div className="w-24">
              <label className="block text-[11px] text-gray-500 mb-1">{t('tasks')}</label>
              <input
                type="text"
                value={tasksFilter}
                onChange={(e) => setTasksFilter(e.target.value)}
                placeholder={t('projectsSearchTasks')}
                className="w-full h-8 px-2 text-xs border border-gray-200 rounded"
              />
            </div>
            <div className="w-36">
              <label className="block text-[11px] text-gray-500 mb-1">{t('role')}</label>
              <input
                type="text"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                placeholder={t('projectsSearchRole')}
                className="w-full h-8 px-2 text-xs border border-gray-200 rounded"
              />
            </div>
            <label className="h-8 inline-flex items-center gap-2 px-2 text-xs text-gray-700 border border-gray-200 rounded">
              <input
                type="checkbox"
                checked={favoritesOnly}
                onChange={(e) => setFavoritesOnly(e.target.checked)}
              />
              {t('favoritesOnly')}
            </label>
            <button
              onClick={resetFilters}
              className="h-8 px-2 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              {t('filterClearAll')}
            </button>
          </div>
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Таблица проектов */}
      {projects.length > 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Заголовки таблицы */}
          <div className="bg-gray-50 px-6 py-3 text-sm font-medium text-gray-600 border-b sticky top-0 z-10">
            <div className="flex items-center">
              <div className="w-[35%]">{t('projectName')}</div>
              <div className="w-[8%] text-center">{t('favorites')}</div>
              <div className="w-[22%] text-center">{t('team')}</div>
              <div className="w-[12%] text-center">{t('tasks')}</div>
              <div className="w-[13%] text-center">{t('role')}</div>
              <div className="w-[10%]" />
            </div>
          </div>

          {/* Строки проектов */}
          <div className="divide-y divide-gray-100">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => onProjectSelect(project.id)}
                className="px-6 py-4 flex items-center hover:bg-gray-50 cursor-pointer transition-colors group"
              >
                {/* Название */}
                <div className="w-[35%] flex flex-col">
                  <span className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {project.name}
                  </span>
                  {project.description && (
                    <span className="text-sm text-gray-500 line-clamp-1 mt-0.5">
                      {project.description}
                    </span>
                  )}
                </div>

                {/* Избранное */}
                <div className="w-[8%] flex justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFavorite(project.id, !project.is_favorite);
                    }}
                    className={`text-lg transition-colors ${project.is_favorite ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-300'}`}
                    title={t('favorites')}
                  >
                    {project.is_favorite ? '★' : '☆'}
                  </button>
                </div>

                {/* Команда */}
                <div className="w-[22%] flex justify-center">
                  <AvatarGroup
                    users={project.members?.slice(0, 4).map(m => ({
                      name: m.full_name || m.username,
                      imageUrl: `/avatar_${m.user_id}.png`
                    })) || [{ name: project.owner_name }]}
                    max={4}
                    size="sm"
                  />
                </div>

                {/* Задачи */}
                <div className="w-[12%] text-center">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    {project.task_count}
                  </span>
                </div>

                {/* Роль */}
                <div className="w-[13%] flex justify-center">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    {getRoleLabel(project.user_role)}
                  </span>
                </div>
                <div className="w-[10%]" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-lg border border-gray-200">
          <div className="bg-gray-100 rounded-full p-6 mb-4">
            <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Нет проектов
          </h3>
          <p className="text-gray-500 mb-6 text-center max-w-md">
            {t('createFirstProject')}
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm hover:shadow transition-all"
          >
            {t('createProject')}
          </button>
        </div>
      )}

      {/* Модальное окно создания проекта */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-2xl font-bold mb-4">Новый проект</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('projectNameLabel')} *
              </label>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Введите название"
                autoFocus
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Описание
              </label>
              <textarea
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded"
                rows={3}
                placeholder="Краткое описание проекта"
                />
              </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewProjectName('');
                  setNewProjectDescription('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleCreateProject}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {t('create')}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

