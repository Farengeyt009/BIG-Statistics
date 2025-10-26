import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { CommentsSection } from './CommentsSection';
import { AttachmentsSection } from './AttachmentsSection';
import { SubtasksSection } from './SubtasksSection';
import { ApprovalsSection } from './ApprovalsSection';
import { CustomFieldsRenderer } from './CustomFieldsRenderer';
import { PriorityDropdown } from './PriorityDropdown';
import { AssigneeSelector } from './AssigneeSelector';
import { useAuth } from '../../../context/AuthContext';
import { useTaskFieldValues } from '../hooks/useCustomFields';
import { useProjectMembers } from '../hooks/useProjectMembers';
import { useStatusTranslation } from '../hooks/useStatusTranslation';
import TaskManagerTranslation from '../TaskManagerTranslation.json';

interface Task {
  id: number;
  project_id: number;
  title: string;
  description?: string;
  status_id: number;
  status_name: string;
  assignee_id?: number;
  assignee_name?: string;
  creator_name?: string;
  priority: string;
  due_date?: string;
  tags?: Array<{ id: number; name: string; color: string }>;
  subtask_count: number;
  comment_count: number;
  attachment_count: number;
  created_at?: string;
  updated_at?: string;
}

interface TaskDetailsModalProps {
  task: Task;
  statuses: any[];
  onClose: () => void;
  onUpdate: (updates: any) => Promise<void>;
  onDelete: () => Promise<void>;
}

const priorityOptions = [
  { value: 'low', icon: '◔', color: '#10b981' },
  { value: 'medium', icon: '◑', color: '#f59e0b' },
  { value: 'high', icon: '◕', color: '#ef4444' },
  { value: 'critical', icon: '●', color: '#7c3aed' },
];

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  task,
  statuses,
  onClose,
  onUpdate,
  onDelete,
}) => {
  const { t, i18n } = useTranslation('taskManager');
  const { user } = useAuth();
  const { translateStatus } = useStatusTranslation();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [statusId, setStatusId] = useState(task.status_id);
  const [priority, setPriority] = useState(task.priority);
  const [assigneeId, setAssigneeId] = useState(task.assignee_id);
  const [assigneeName, setAssigneeName] = useState(task.assignee_name);

  // Load translations for Task Manager
  React.useEffect(() => {
    const currentLang = i18n.language;
    if (TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(currentLang, 'taskManager', TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);
  
  // Форматируем дату в формат YYYY-MM-DD для input type="date"
  const formatDateForInput = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  };
  
  const [dueDate, setDueDate] = useState(formatDateForInput(task.due_date));
  const [activeTab, setActiveTab] = useState<'subtasks' | 'comments' | 'files' | 'approvals'>('subtasks');
  const [isSaving, setIsSaving] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<number, string>>({});
  const [attachmentCount, setAttachmentCount] = useState(task.attachment_count);
  const [commentCount, setCommentCount] = useState(task.comment_count);
  const [subtaskCount, setSubtaskCount] = useState(task.subtask_count);
  const { fieldValues } = useTaskFieldValues(task.id);
  const { members } = useProjectMembers(task.project_id);

  const currentPriority = priorityOptions.find(p => p.value === priority) || priorityOptions[1];
  const currentStatus = statuses.find(s => s.id === statusId);

  const handleSave = async () => {
    // Проверяем обязательные кастомные поля
    const emptyRequiredFields = fieldValues.filter(
      fv => fv.is_required && (!customFieldValues[fv.field_id] || customFieldValues[fv.field_id].trim() === '')
    );

    if (emptyRequiredFields.length > 0) {
      alert(
        `${t('validation.fillRequiredFields')}\n${emptyRequiredFields.map(f => `• ${f.field_name}`).join('\n')}`
      );
      return;
    }

    setIsSaving(true);
    try {
      // Сохраняем кастомные поля СНАЧАЛА
      const token = localStorage.getItem('authToken');
      for (const [fieldId, value] of Object.entries(customFieldValues)) {
        await fetch(`/api/task-manager/custom-fields/task/${task.id}/values`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ field_id: parseInt(fieldId), value }),
        });
      }

      // Потом сохраняем основные поля
      await onUpdate({
        title,
        description,
        status_id: statusId,
        priority,
        due_date: dueDate || null,
        assignee_id: assigneeId || null,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(t('validation.deleteTaskConfirm'))) {
      await onDelete();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl h-[85vh] overflow-hidden flex flex-col">
        {/* Заголовок */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3 flex-1">
            <span className="text-sm text-gray-500">#{task.id}</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xl font-semibold flex-1 border-none focus:outline-none focus:ring-0 bg-transparent"
              placeholder={t('taskModalTitle')}
            />
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Основной контент */}
        <div className="flex h-full overflow-hidden">
          {/* Левая часть - контент */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Описание */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('taskModalDescription')}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={4}
                placeholder={t('taskModalDescriptionPlaceholder')}
              />
            </div>

            {/* Табы */}
            <div>
              <div className="flex gap-1 border-b">
                <button
                  onClick={() => setActiveTab('subtasks')}
                  className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                    activeTab === 'subtasks'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {t('taskModalSubtasks')} ({subtaskCount})
                </button>
                <button
                  onClick={() => setActiveTab('comments')}
                  className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                    activeTab === 'comments'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {t('taskModalComments')} ({commentCount})
                </button>
                <button
                  onClick={() => setActiveTab('files')}
                  className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                    activeTab === 'files'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {t('taskModalFiles')} ({attachmentCount})
                </button>
                <button
                  onClick={() => setActiveTab('approvals')}
                  className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                    activeTab === 'approvals'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {t('taskModalApprovals')}
                </button>
              </div>

              {/* Содержимое табов - скрываем вместо демонтирования */}
              <div className="mt-4">
                <div style={{ display: activeTab === 'subtasks' ? 'block' : 'none' }}>
                  <SubtasksSection
                    taskId={task.id}
                    projectId={task.project_id}
                    statuses={statuses}
                    onCountChange={setSubtaskCount}
                  />
                </div>

                <div style={{ display: activeTab === 'comments' ? 'block' : 'none' }}>
                  <CommentsSection 
                    taskId={task.id} 
                    currentUserId={user?.user_id || 0}
                    onCountChange={setCommentCount}
                  />
                </div>

                <div style={{ display: activeTab === 'files' ? 'block' : 'none' }}>
                  <AttachmentsSection 
                    taskId={task.id} 
                    currentUserId={user?.user_id || 0}
                    onCountChange={setAttachmentCount}
                  />
                </div>

                <div style={{ display: activeTab === 'approvals' ? 'block' : 'none' }}>
                  <ApprovalsSection 
                    taskId={task.id} 
                    currentUserId={user?.user_id || 0}
                    projectId={task.project_id}
                    statusId={statusId}
                    onAutoTransition={() => {
                      // Просто закрываем модалку
                      // Автоперевод уже произошел на сервере
                      onClose();
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Метаинформация */}
            <div className="pt-4 mt-auto border-t text-sm text-gray-500 space-y-1">
              <div>
                <span className="font-medium">{t('taskModalCreator')}</span> {task.creator_name || 'N/A'}
              </div>
              <div>
                <span className="font-medium">{t('taskModalCreated')}</span>{' '}
                {task.created_at ? format(new Date(task.created_at), 'dd.MM.yyyy HH:mm') : 'N/A'}
              </div>
              {task.updated_at && task.updated_at !== task.created_at && (
                <div>
                  <span className="font-medium">{t('taskModalUpdated')}</span>{' '}
                  {format(new Date(task.updated_at), 'dd.MM.yyyy HH:mm')}
                </div>
              )}
            </div>
            </div>
          </div>

          {/* Правая панель - поля */}
          <div className="w-80 bg-gray-50 border-l overflow-y-auto">
            <div className="p-5 space-y-4">
            
            {/* Статус */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">
                {t('taskModalStatus')}
              </label>
              <select
                value={statusId}
                onChange={(e) => setStatusId(parseInt(e.target.value))}
                className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                {statuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {translateStatus(status)}
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
                className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* Исполнитель */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">
                {t('taskModalAssignee')}
              </label>
              <AssigneeSelector
                projectId={task.project_id}
                assigneeId={assigneeId}
                assigneeName={assigneeName}
                onUpdate={(newAssigneeId) => {
                  setAssigneeId(newAssigneeId);
                  if (newAssigneeId) {
                    const member = members.find(m => m.user_id === newAssigneeId);
                    setAssigneeName(member?.full_name || member?.username || '');
                  } else {
                    setAssigneeName(undefined);
                  }
                }}
              />
            </div>

            {/* Теги */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">
                {t('taskModalTags')}
              </label>
              {task.tags && task.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {task.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: `${tag.color}15`,
                        color: tag.color,
                        border: `1px solid ${tag.color}30`,
                      }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">{t('taskModalNoTags')}</p>
              )}
            </div>

            {/* Кастомные поля */}
            <CustomFieldsRenderer 
              taskId={task.id}
              onValuesChange={setCustomFieldValues}
            />

            {/* Статистика - внизу */}
            <div className="pt-4 mt-auto border-t">
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-xs">{t('taskModalSubtasks')}</span>
                  <span className="font-medium text-gray-900">{subtaskCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-xs">{t('taskModalComments')}</span>
                  <span className="font-medium text-gray-900">{commentCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-xs">{t('taskModalFiles')}</span>
                  <span className="font-medium text-gray-900">{attachmentCount}</span>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>

        {/* Футер */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            {t('taskModalDeleteTask')}
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
            >
              {t('taskModalCancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSaving ? t('taskModalSaving') : t('taskModalSave')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
