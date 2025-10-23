import React, { useState } from 'react';
import { useProjects } from './hooks/useProjects';

interface ProjectsListPageProps {
  onProjectSelect: (projectId: number) => void;
}

export const ProjectsListPage: React.FC<ProjectsListPageProps> = ({ onProjectSelect }) => {
  const { projects, loading, error, createProject } = useProjects();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      alert('Введите название проекта');
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
        <div className="text-gray-500">Загрузка проектов...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Заголовок */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Task Manager</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Создать проект
        </button>
      </div>

      {/* Ошибка */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Список проектов */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => (
          <div
            key={project.id}
            onClick={() => onProjectSelect(project.id)}
            className="group bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-lg cursor-pointer transition-all duration-200"
          >
            {/* Категория */}
            {project.category_name && (
              <div className="mb-3">
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{
                    backgroundColor: project.category_color ? `${project.category_color}15` : '#f3f4f6',
                    color: project.category_color || '#6b7280',
                    border: `1px solid ${project.category_color ? project.category_color + '30' : '#e5e7eb'}`,
                  }}
                >
                  {project.category_name}
                </span>
              </div>
            )}

            {/* Название */}
            <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
              {project.name}
            </h3>

            {/* Описание */}
            {project.description && (
              <p className="text-gray-600 text-sm mb-4 line-clamp-2 leading-relaxed">
                {project.description}
              </p>
            )}

            {/* Статистика */}
            <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>{project.task_count} задач</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span>{project.member_count}</span>
              </div>
            </div>

            {/* Роль */}
            <div className="pt-3 border-t border-gray-100">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-50 px-2.5 py-1 rounded-full">
                {project.user_role}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Пустое состояние */}
      {projects.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="bg-gray-100 rounded-full p-6 mb-4">
            <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Нет проектов
          </h3>
          <p className="text-gray-500 mb-6 text-center max-w-md">
            Создайте свой первый проект для начала работы с задачами
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm hover:shadow transition-all"
          >
            Создать проект
          </button>
        </div>
      )}

      {/* Модальное окно создания проекта */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">Новый проект</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Название проекта *
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
                Отмена
              </button>
              <button
                onClick={handleCreateProject}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

