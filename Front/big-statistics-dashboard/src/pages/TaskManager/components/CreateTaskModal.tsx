import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStatusTranslation } from '../hooks/useStatusTranslation';
import TaskManagerTranslation from '../TaskManagerTranslation.json';
import { PriorityDropdown } from './PriorityDropdown';
import { AssigneeSelector } from './AssigneeSelector';
import { useCustomFields } from '../hooks/useCustomFields';

interface CreateTaskModalProps {
  isOpen: boolean;
  statusId: number;
  statuses: any[];
  projectId: number;
  onClose: () => void;
  onCreate: (taskData: any) => Promise<boolean>;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  statusId,
  statuses,
  projectId,
  onClose,
  onCreate,
}) => {
  const { t, i18n } = useTranslation('taskManager');
  const { translateStatus } = useStatusTranslation();
  
  // Load translations for Task Manager
  useEffect(() => {
    const currentLang = i18n.language;
    if (TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(currentLang, 'taskManager', TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedStatusId, setSelectedStatusId] = useState(statusId);
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<number, string>>({});
  
  const { fields } = useCustomFields(projectId);

  const handleCreate = async () => {
    if (!title.trim()) {
      alert(t('validation.enterTaskTitle'));
      return;
    }

    // Проверяем обязательные кастомные поля
    const activeFields = fields.filter(f => f.is_active);
    const emptyRequiredFields = activeFields.filter(
      f => f.is_required && (!customFieldValues[f.id] || customFieldValues[f.id].trim() === '')
    );

    if (emptyRequiredFields.length > 0) {
      alert(
        t('validation.fillRequiredFields') + '\n' +
        emptyRequiredFields.map(f => `• ${f.field_name}`).join('\n')
      );
      return;
    }

    setIsCreating(true);
    try {
      // Сохраняем задачу
      const taskData = {
        title,
        description: description || undefined,
        status_id: selectedStatusId,
        priority,
        due_date: dueDate || undefined,
        assignee_id: assigneeId || undefined,
      };
      
      // Вызываем onCreate который вернет ID созданной задачи (number) или null
      const taskId = await onCreate(taskData);
      
      if (taskId) {
        // Получили ID задачи - сохраняем кастомные поля
        const token = localStorage.getItem('authToken');
        for (const [fieldId, value] of Object.entries(customFieldValues)) {
          if (value && value.trim()) {
            await fetch(`/api/task-manager/custom-fields/task/${taskId}/values`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ field_id: parseInt(fieldId), value }),
            });
          }
        }
        
        // Очистить форму
        setTitle('');
        setDescription('');
        setPriority('medium');
        setDueDate('');
        setAssigneeId(null);
        setCustomFieldValues({});
        onClose();
      }
    } finally {
      setIsCreating(false);
    }
  };

  // Рендерим кастомное поле
  const renderCustomField = (field: any) => {
    const value = customFieldValues[field.id] || '';

    switch (field.field_type) {
      case 'text':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))}
            className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder={field.is_required ? t('validation.required') : ''}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))}
            className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder={field.is_required ? t('validation.required') : ''}
          />
        );
      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))}
            className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
          />
        );
      case 'select':
        const options = field.field_options ? JSON.parse(field.field_options) : [];
        return (
          <select
            value={value}
            onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))}
            className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">{t('taskModalSelectOption')}</option>
            {options.map((option: string, idx: number) => (
              <option key={idx} value={option}>{option}</option>
            ))}
          </select>
        );
      case 'checkbox':
        return (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value === 'true'}
              onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.checked ? 'true' : 'false' }))}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">{t('taskModalYes')}</span>
          </label>
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  const activeFields = fields.filter(f => f.is_active);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl h-[85vh] overflow-hidden flex flex-col shadow-xl">
        {/* Заголовок */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">{t('taskModalTitle')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            ×
          </button>
        </div>

        {/* Основной контент */}
        <div className="flex h-full overflow-hidden">
          {/* Левая часть - основные поля */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Название */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('taskModalTitle')} *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={t('taskModalEnterTitle')}
                  autoFocus
                />
              </div>

              {/* Описание */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('taskModalDescription')}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={6}
                  placeholder={t('taskModalAddDescription')}
                />
              </div>

              <div className="text-sm text-gray-500">
                {t('taskModalAfterCreation')}
              </div>
            </div>
          </div>

          {/* Правая панель - свойства */}
          <div className="w-80 bg-gray-50 border-l overflow-y-auto">
            <div className="p-5 space-y-4">
              {/* Статус */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">
                  {t('taskModalStatus')}
                </label>
                <select
                  value={selectedStatusId}
                  onChange={(e) => setSelectedStatusId(parseInt(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {translateStatus(s)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Приоритет */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">
                  {t('taskModalPriority')}
                </label>
                <PriorityDropdown value={priority} onChange={setPriority} />
              </div>

              {/* Срок выполнения */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">
                  {t('taskModalDueDate')}
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              {/* Исполнитель */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">
                  {t('taskModalAssignee')}
                </label>
                <AssigneeSelector
                  projectId={projectId}
                  assigneeId={assigneeId || undefined}
                  assigneeName={undefined}
                  onUpdate={(newAssigneeId) => {
                    setAssigneeId(newAssigneeId);
                  }}
                />
              </div>

              {/* Кастомные поля */}
              {activeFields.length > 0 && (
                <div className="pt-4 border-t space-y-4">
                  <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    {t('taskModalAdditionalFields')}
                  </h4>
                  {activeFields.map((field) => (
                    <div key={field.id}>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">
                        {field.field_name}
                        {field.is_required && <span className="text-red-600 ml-1">*</span>}
                      </label>
                      {renderCustomField(field)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Футер */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            onClick={() => {
              setTitle('');
              setDescription('');
              setPriority('medium');
              setDueDate('');
              setAssigneeId(null);
              setCustomFieldValues({});
              onClose();
            }}
            disabled={isCreating}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            {t('taskModalCancel')}
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !title.trim()}
            className="px-6 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? t('taskModalCreating') : t('taskModalCreateTask')}
          </button>
        </div>
      </div>
    </div>
  );
};

