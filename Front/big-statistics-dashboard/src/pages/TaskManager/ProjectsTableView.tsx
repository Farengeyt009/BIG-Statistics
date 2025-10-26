import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjects } from './hooks/useProjects';
import { ProgressBar } from './components/ui/ProgressBar';
import { AvatarGroup } from './components/ui/Avatar';
import TaskManagerTranslation from './TaskManagerTranslation.json';

interface ProjectsTableViewProps {
  onProjectSelect: (projectId: number) => void;
}

export const ProjectsTableView: React.FC<ProjectsTableViewProps> = ({ onProjectSelect }) => {
  const { t, i18n } = useTranslation('taskManager');
  const { projects, loading, error, createProject } = useProjects();

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

  if (loading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{t('loadingProjects')}</div>
      </div>
    );
  }

  // Вычисляем процент выполнения для каждого проекта
  const projectsWithProgress = projects.map((project) => {
    // Считаем завершенные задачи (это нужно будет получать из API)
    // Пока используем task_count как общее количество
    const completedTasks = 0; // TODO: получить из API
    const percentage = project.task_count > 0 ? (completedTasks / project.task_count) * 100 : 0;
    
    return {
      ...project,
      completedTasks,
      percentage,
    };
  });

  return (
    <div className="p-6">
      {/* Заголовок */}
      <div className="flex justify-end items-center mb-6">
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium"
        >
          {t('createProjectButton')}
        </button>
      </div>

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
          <div className="bg-gray-50 px-6 py-3 text-sm font-medium text-gray-600 flex items-center border-b sticky top-0 z-10">
            <div className="w-[35%]">{t('projectName')}</div>
            <div className="w-[15%]">{t('progress')}</div>
            <div className="w-[5%]"></div>
            <div className="w-[20%] text-center">{t('team')}</div>
            <div className="w-[10%] text-center">{t('tasks')}</div>
            <div className="w-[15%] text-center">{t('role')}</div>
          </div>

          {/* Строки проектов */}
          <div className="divide-y divide-gray-100">
            {projectsWithProgress.map((project) => (
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

                {/* Прогресс */}
                <div className="w-[15%]">
                  <ProgressBar 
                    value={project.percentage}
                    height="sm"
                  />
                  <span className="text-xs text-gray-500 mt-1 block">
                    {project.completedTasks} / {project.task_count}
                  </span>
                </div>

                {/* Невидимое поле-костыль */}
                <div className="w-[5%]"></div>

                {/* Команда */}
                <div className="w-[20%] flex justify-center">
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
                <div className="w-[10%] text-center">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    {project.task_count}
                  </span>
                </div>

                {/* Роль */}
                <div className="w-[15%] flex justify-center">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    {project.user_role}
                  </span>
                </div>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
    </div>
  );
};

