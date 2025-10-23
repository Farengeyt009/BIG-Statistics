import React, { useState } from 'react';
import { useWorkflow } from '../hooks/useWorkflow';
import { TransitionsEditor } from './TransitionsEditor';
import { WorkflowSettings } from './WorkflowSettings';

interface WorkflowEditorProps {
  projectId: number;
}

export const WorkflowEditor: React.FC<WorkflowEditorProps> = ({ projectId }) => {
  const { statuses, loading, fetchStatuses, createStatus, updateStatus, deleteStatus } = useWorkflow(projectId);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingStatus, setEditingStatus] = useState<any>(null);
  const [statusName, setStatusName] = useState('');
  const [statusColor, setStatusColor] = useState('#3b82f6');
  const [isInitial, setIsInitial] = useState(false);
  const [isFinal, setIsFinal] = useState(false);

  const colors = [
    { value: '#3b82f6', label: 'Синий' },
    { value: '#10b981', label: 'Зеленый' },
    { value: '#f59e0b', label: 'Оранжевый' },
    { value: '#ef4444', label: 'Красный' },
    { value: '#8b5cf6', label: 'Фиолетовый' },
    { value: '#6b7280', label: 'Серый' },
  ];

  const handleCreate = async () => {
    if (!statusName.trim()) {
      alert('Введите название статуса');
      return;
    }

    const success = await createStatus({
      name: statusName,
      color: statusColor,
      is_initial: isInitial,
      is_final: isFinal,
    });

    if (success) {
      resetForm();
      setShowCreateModal(false);
    }
  };

  const handleUpdate = async () => {
    if (!statusName.trim()) {
      alert('Введите название статуса');
      return;
    }

    const success = await updateStatus(editingStatus.id, {
      name: statusName,
      color: statusColor,
      is_initial: isInitial,
      is_final: isFinal,
    });

    if (success) {
      resetForm();
      setEditingStatus(null);
    }
  };

  const resetForm = () => {
    setStatusName('');
    setStatusColor('#3b82f6');
    setIsInitial(false);
    setIsFinal(false);
  };

  const startEdit = (status: any) => {
    setEditingStatus(status);
    setStatusName(status.name);
    setStatusColor(status.color);
    setIsInitial(status.is_initial);
    setIsFinal(status.is_final);
  };

  if (loading && statuses.length === 0) {
    return <div className="text-center py-8 text-gray-500">Загрузка...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Воркфлоу проекта</h3>
          <p className="text-sm text-gray-500 mt-1">
            Настройте статусы и переходы для задач этого проекта
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + Добавить статус
        </button>
      </div>

      {/* Настройка проверки прав */}
      <WorkflowSettings projectId={projectId} />

      {/* Список статусов */}
      <div className="space-y-3">
        {statuses
          .sort((a, b) => a.order_index - b.order_index)
          .map((status, index) => (
            <div
              key={status.id}
              className="flex items-center justify-between p-4 border border-gray-200 bg-white rounded-lg hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-4">
                {/* Порядок */}
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => {
                      if (index === 0) return;
                      const sortedStatuses = [...statuses].sort((a, b) => a.order_index - b.order_index);
                      const prevStatus = sortedStatuses[index - 1];
                      // Меняемся местами с предыдущим (без await - параллельно)
                      updateStatus(status.id, { order_index: prevStatus.order_index });
                      updateStatus(prevStatus.id, { order_index: status.order_index });
                    }}
                    disabled={index === 0}
                    className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      if (index === statuses.length - 1) return;
                      const sortedStatuses = [...statuses].sort((a, b) => a.order_index - b.order_index);
                      const nextStatus = sortedStatuses[index + 1];
                      // Меняемся местами со следующим (без await - параллельно)
                      updateStatus(status.id, { order_index: nextStatus.order_index });
                      updateStatus(nextStatus.id, { order_index: status.order_index });
                    }}
                    disabled={index === statuses.length - 1}
                    className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Цвет */}
                <div
                  className="w-4 h-4 rounded-full border border-gray-300"
                  style={{ backgroundColor: status.color }}
                />

                {/* Название */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{status.name}</span>
                    {status.is_system && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded font-medium flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Системный
                      </span>
                    )}
                    {status.is_initial && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded font-medium">
                        Начальный
                      </span>
                    )}
                    {status.is_final && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded font-medium">
                        Финальный
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Порядок: {status.order_index}
                  </div>
                </div>
              </div>

              {/* Действия */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => startEdit(status)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Редактировать"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={async () => {
                    if (confirm(`Удалить статус "${status.name}"?`)) {
                      const success = await deleteStatus(status.id);
                      if (!success) {
                        // Ошибка уже показана через alert от сервера
                      }
                    }
                  }}
                  disabled={status.is_system}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-30"
                  title={status.is_system ? 'Системный статус нельзя удалить' : 'Удалить'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
      </div>

      {/* Модалка создания/редактирования */}
      {(showCreateModal || editingStatus) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-xl font-semibold mb-4">
              {editingStatus ? 'Редактировать статус' : 'Создать статус'}
            </h3>

            {/* Название */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Название *
              </label>
              <input
                type="text"
                value={statusName}
                onChange={(e) => setStatusName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="Например: На согласовании"
                autoFocus
              />
            </div>

            {/* Цвет */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Цвет
              </label>
              <div className="grid grid-cols-3 gap-2">
                {colors.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setStatusColor(color.value)}
                    className={`flex items-center gap-2 px-3 py-2 border rounded-md transition-colors ${
                      statusColor === color.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: color.value }}
                    />
                    <span className="text-sm">{color.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Флаги */}
            <div className="mb-6 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInitial}
                  onChange={(e) => setIsInitial(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">
                  Начальный статус (новые задачи создаются в этом статусе)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFinal}
                  onChange={(e) => setIsFinal(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">
                  Финальный статус (задача считается завершенной)
                </span>
              </label>
            </div>

            {/* Кнопки */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  resetForm();
                  setShowCreateModal(false);
                  setEditingStatus(null);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Отмена
              </button>
              <button
                onClick={editingStatus ? handleUpdate : handleCreate}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {editingStatus ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Редактор переходов */}
      {statuses.length > 0 && (
        <TransitionsEditor
          projectId={projectId}
          statuses={statuses}
          onSave={() => fetchStatuses()}
        />
      )}
    </div>
  );
};

