import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { X, Trash2, Save, Calendar, User, Tag, Clock, ChevronRight, ChevronDown } from 'lucide-react';
import { CommentsSection } from './CommentsSection';
import { AttachmentsSection } from './AttachmentsSection';
import { SubtasksSection } from './SubtasksSection';
import { ApprovalsSection } from './ApprovalsSection';
import { CustomFieldsRenderer } from './CustomFieldsRenderer';
import { PriorityDropdown } from './PriorityDropdown';
import { PriorityIcon } from './PrioritySelector';
import { AssigneeSelector } from './AssigneeSelector';
import { Avatar } from './ui/Avatar';
import { useAuth } from '../../../context/AuthContext';
import { useTaskFieldValues, useCustomFields } from '../hooks/useCustomFields';
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
  status_color?: string;
  assignee_id?: number;
  assignee_name?: string;
  creator_name?: string;
  priority: string;
  due_date?: string;
  start_date?: string;
  tags?: Array<{ id: number; name: string; color: string }>;
  subtask_count: number;
  comment_count: number;
  attachment_count: number;
  created_at?: string;
  updated_at?: string;
}

interface TaskDetailsModalProps {
  task?: Task;
  mode?: 'create' | 'edit';
  projectId?: number;
  initialStatusId?: number;
  statuses: any[];
  onClose: () => void;
  onUpdate?: (updates: any) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCreate?: (taskData: any) => Promise<number | null | false>;
  onTaskAutoTransitioned?: (taskId: number, newStatusId: number) => void;
}

type ActivityTab = 'main' | 'subtasks' | 'comments' | 'files' | 'approvals';

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  task,
  mode = 'edit',
  projectId: projectIdProp,
  initialStatusId,
  statuses,
  onClose,
  onUpdate,
  onDelete,
  onCreate,
  onTaskAutoTransitioned,
}) => {
  const { t, i18n } = useTranslation('taskManager');
  const { user } = useAuth();
  const { translateStatus } = useStatusTranslation();

  const isCreateMode = mode === 'create';
  const effectiveProjectId = task?.project_id ?? projectIdProp ?? 0;

  // In create mode only allow initial statuses
  const creatableStatuses = isCreateMode
    ? statuses.filter((s) => s.is_initial)
    : statuses;

  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [statusId, setStatusId] = useState(() => {
    if (task?.status_id) return task.status_id;
    if (initialStatusId) return initialStatusId;
    // In create mode prefer first initial status
    if (mode === 'create') {
      const firstInitial = statuses.find((s) => s.is_initial);
      return firstInitial?.id ?? statuses[0]?.id ?? 0;
    }
    return statuses[0]?.id ?? 0;
  });
  const [priority, setPriority] = useState(task?.priority ?? 'medium');
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id);
  const [assigneeName, setAssigneeName] = useState(task?.assignee_name);
  const [activeTab, setActiveTab] = useState<ActivityTab>('main');
  const [isSaving, setIsSaving] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [customRows, setCustomRows] = useState<import('../hooks/useCustomFields').FieldRow[]>([]);
  const [attachmentCount, setAttachmentCount] = useState(task?.attachment_count ?? 0);
  const [commentCount, setCommentCount] = useState(task?.comment_count ?? 0);
  const [subtaskCount, setSubtaskCount] = useState(task?.subtask_count ?? 0);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { fieldData, fieldValues } = useTaskFieldValues(isCreateMode ? 0 : (task?.id ?? 0));
  const { fields: projectFields } = useCustomFields(isCreateMode ? effectiveProjectId : 0);
  const { members } = useProjectMembers(effectiveProjectId);

  React.useEffect(() => {
    const currentLang = i18n.language;
    if (TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(currentLang, 'taskManager', TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);

  // ESC для закрытия
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const formatDateForInput = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    } catch { return ''; }
  };

  const [dueDate, setDueDate] = useState(formatDateForInput(task?.due_date));
  const [startDate, setStartDate] = useState(formatDateForInput(task?.start_date));

  const dateInputRef = React.useRef<HTMLInputElement>(null);
  const startDateInputRef = React.useRef<HTMLInputElement>(null);

  // Синхронизируем локальное состояние при смене выбранной задачи
  React.useEffect(() => {
    if (isCreateMode || !task) return;
    setTitle(task.title ?? '');
    setDescription(task.description ?? '');
    setStatusId(task.status_id ?? statuses[0]?.id ?? 0);
    setPriority(task.priority ?? 'medium');
    setAssigneeId(task.assignee_id);
    setAssigneeName(task.assignee_name);
    setDueDate(formatDateForInput(task.due_date));
    setStartDate(formatDateForInput(task.start_date));
    setAttachmentCount(task.attachment_count ?? 0);
    setCommentCount(task.comment_count ?? 0);
    setSubtaskCount(task.subtask_count ?? 0);
  }, [isCreateMode, task, statuses]);

  const handleAutoTransition = useCallback(async () => {
    if (!task) return;
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`/api/task-manager/tasks/${task.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data) {
        const newStatusId = data.data.status_id;
        setStatusId(newStatusId);
        if (onTaskAutoTransitioned) onTaskAutoTransitioned(task.id, newStatusId);
      }
    } catch { /* ignore */ }
  }, [task, onTaskAutoTransitioned]);

  const currentStatus = statuses.find(s => s.id === statusId);

  const handleSave = async () => {
    setSaveError(null);
    if (!title.trim()) {
      alert(t('validation.enterTaskTitle') || 'Enter task title');
      return;
    }

    if (isCreateMode) {
      // Режим создания
      setIsSaving(true);
      try {
        const newTaskId = await onCreate?.({
          title,
          description: description || undefined,
          status_id: statusId,
          priority,
          due_date: dueDate || undefined,
          start_date: startDate || undefined,
          assignee_id: assigneeId || undefined,
        });
        if (newTaskId) {
          // Сохраняем кастомные поля если есть заполненные
          if (customRows.length > 0) {
            const token = localStorage.getItem('authToken');
            await fetch(`/api/task-manager/custom-fields/task/${newTaskId}/rows`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ rows: customRows }),
            });
          }
          onClose();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : (t('validation.saveError') || 'Save error');
        setSaveError(message);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem('authToken');
      if (customRows.length > 0) {
        await fetch(`/api/task-manager/custom-fields/task/${task!.id}/rows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ rows: customRows }),
        });
      }
      await onUpdate?.({ title, description, status_id: statusId, priority, due_date: dueDate || null, start_date: startDate || null, assignee_id: assigneeId || null });
    } catch (err) {
      const message = err instanceof Error ? err.message : (t('validation.saveError') || 'Save error');
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(t('validation.deleteTaskConfirm'))) {
      await onDelete?.();
      onClose();
    }
  };

  const TABS: { id: ActivityTab; label: string; count?: number }[] = isCreateMode
    ? [{ id: 'main', label: t('taskModalMain') }]
    : [
        { id: 'main',      label: t('taskModalMain') },
        { id: 'subtasks',  label: t('taskModalSubtasks'),  count: subtaskCount },
        { id: 'comments',  label: t('taskModalComments'),  count: commentCount },
        { id: 'files',     label: t('taskModalFiles'),     count: attachmentCount },
        { id: 'approvals', label: t('taskModalApprovals') },
      ];

  return (
    <div className="absolute inset-0 z-20 bg-white flex flex-col overflow-hidden">

      {/* ── Топбар ── */}
      <div className="flex items-center justify-between px-6 h-12 border-b border-gray-200 shrink-0 bg-white">
        {/* Хлебные крошки */}
        <div className="flex items-center gap-1.5 text-sm text-gray-400 min-w-0">
          <span className="truncate max-w-[180px]">{effectiveProjectId}</span>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          <span className="text-gray-500 font-medium shrink-0">
            {isCreateMode ? t('taskModalCreateTask') : `#${task?.id}`}
          </span>
        </div>

        {/* Правые кнопки */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving
              ? (isCreateMode ? t('taskModalCreating') : t('taskModalSaving'))
              : (isCreateMode ? t('taskModalCreateTask') : t('taskModalSave'))
            }
          </button>
          {!isCreateMode && onDelete && (
            <button
              onClick={handleDelete}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
              title={t('taskModalDeleteTask')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <div className="w-px h-5 bg-gray-200" />
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Основной layout: контент + правая панель ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Левая часть: контент ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-8 py-8">
            {saveError && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {saveError}
              </div>
            )}

            {/* Заголовок */}
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = el.scrollHeight + 'px';
              }}
              className="w-full text-2xl font-bold text-gray-900 resize-none border-none outline-none bg-transparent leading-snug mb-4 placeholder:text-gray-300"
              placeholder={t('taskModalTitle')}
              rows={1}
              style={{ overflow: 'hidden' }}
            />

            {/* ── Inline-поля под заголовком (как в Plane) ── */}
            <div className="flex items-center flex-wrap gap-1 mb-8 -ml-1">

              {/* Статус */}
              <InlineStatusPicker
                statuses={isCreateMode ? creatableStatuses : statuses}
                statusId={statusId}
                currentStatus={currentStatus}
                translateStatus={translateStatus}
                onChange={setStatusId}
              />

              {/* Приоритет */}
              <InlinePriorityPicker priority={priority} onChange={setPriority} t={t} />

              {/* Исполнитель */}
              <InlineAssigneePicker
                projectId={effectiveProjectId}
                assigneeId={assigneeId}
                assigneeName={assigneeName}
                members={members}
                onUpdate={(id) => {
                  setAssigneeId(id);
                  if (id) {
                    const m = members.find(m => m.user_id === id);
                    setAssigneeName(m?.full_name || m?.username || '');
                  } else {
                    setAssigneeName(undefined);
                  }
                }}
              />

              {/* Дата начала */}
              <div className="relative inline-flex">
                <button
                  type="button"
                  onClick={() => {
                    const el = startDateInputRef.current;
                    if (!el) return;
                    if (typeof (el as any).showPicker === 'function') {
                      (el as any).showPicker();
                    } else {
                      el.focus();
                      el.click();
                    }
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm hover:bg-gray-100 transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className={startDate ? 'text-gray-800 font-medium' : 'text-gray-400'}>
                    {startDate ? format(new Date(startDate + 'T00:00:00'), 'dd.MM.yyyy') : t('taskModalStartDate')}
                  </span>
                </button>
                <input
                  ref={startDateInputRef}
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="absolute bottom-0 left-0 w-0 h-0 opacity-0 border-0 p-0"
                  tabIndex={-1}
                />
              </div>

              {/* Дедлайн */}
              <div className="relative inline-flex">
                <button
                  type="button"
                  onClick={() => {
                    const el = dateInputRef.current;
                    if (!el) return;
                    if (typeof (el as any).showPicker === 'function') {
                      (el as any).showPicker();
                    } else {
                      el.focus();
                      el.click();
                    }
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm hover:bg-gray-100 transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className={dueDate ? 'text-gray-800 font-medium' : 'text-gray-400'}>
                    {dueDate ? format(new Date(dueDate + 'T00:00:00'), 'dd.MM.yyyy') : t('taskModalDueDate')}
                  </span>
                </button>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="absolute bottom-0 left-0 w-0 h-0 opacity-0 border-0 p-0"
                  tabIndex={-1}
                />
              </div>
            </div>

            {/* ── Табы ── */}
            <div className="border-b border-gray-200 mb-6">
              <div className="flex gap-0">
                {TABS.map(({ id, label, count }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                    }`}
                  >
                    {label}
                    {count !== undefined && count > 0 && (
                      <span className="ml-1.5 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Содержимое табов ── */}
            <div>
              {/* Основная вкладка: описание + кастомные поля */}
              <div style={{ display: activeTab === 'main' ? 'block' : 'none' }}>
                {/* Секция: Описание */}
                <div className="mb-4">
                  <button
                    onClick={() => setDetailsOpen(!detailsOpen)}
                    className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 mb-3 group"
                  >
                    {detailsOpen
                      ? <ChevronDown className="w-4 h-4 transition-transform" />
                      : <ChevronRight className="w-4 h-4 transition-transform" />
                    }
                    <span>{t('taskModalDescription')}</span>
                  </button>
                  {detailsOpen && (
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full text-sm text-gray-700 border border-transparent hover:border-gray-200 focus:border-gray-300 rounded-lg px-3 py-2.5 resize-none outline-none transition-colors placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20"
                      rows={5}
                      placeholder={t('taskModalDescriptionPlaceholder')}
                    />
                  )}
                </div>
                {/* Секция: Additional Fields */}
                <AdditionalFieldsSection
                  taskId={isCreateMode ? 0 : task!.id}
                  projectId={effectiveProjectId}
                  fieldData={fieldData}
                  projectFields={projectFields}
                  onRowsChange={setCustomRows}
                />
              </div>

              {!isCreateMode && (
                <>
                  <div style={{ display: activeTab === 'subtasks' ? 'block' : 'none' }}>
                    <SubtasksSection taskId={task!.id} projectId={effectiveProjectId} statuses={statuses} onCountChange={setSubtaskCount} />
                  </div>
                  <div style={{ display: activeTab === 'comments' ? 'block' : 'none' }}>
                    <CommentsSection taskId={task!.id} currentUserId={user?.user_id || 0} onCountChange={setCommentCount} />
                  </div>
                  <div style={{ display: activeTab === 'files' ? 'block' : 'none' }}>
                    <AttachmentsSection taskId={task!.id} currentUserId={user?.user_id || 0} onCountChange={setAttachmentCount} />
                  </div>
                  <div style={{ display: activeTab === 'approvals' ? 'block' : 'none' }}>
                    <ApprovalsSection taskId={task!.id} currentUserId={user?.user_id || 0} projectId={effectiveProjectId} statusId={statusId} onAutoTransition={handleAutoTransition} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Правая панель: свойства ── */}
        <div className="w-72 shrink-0 border-l border-gray-200 bg-gray-50 overflow-y-auto">
          <div className="px-5 py-6 space-y-1">

            {/* Теги — только в edit mode */}
            {!isCreateMode && task?.tags && task.tags.length > 0 && (
              <PropRow icon={<Tag className="w-3.5 h-3.5 text-gray-400" />} label={t('taskModalTags')}>
                <div className="flex flex-wrap gap-1">
                  {task.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="px-1.5 py-0.5 rounded text-xs font-medium"
                      style={{ backgroundColor: `${tag.color}15`, color: tag.color, border: `1px solid ${tag.color}30` }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              </PropRow>
            )}

            {/* Мета — только в edit mode */}
            {!isCreateMode && (
              <>
                <div className="pt-4 pb-1">
                  <div className="h-px bg-gray-200" />
                </div>
                <PropRow icon={<User className="w-3.5 h-3.5 text-gray-400" />} label={t('taskModalCreator')}>
                  <span className="text-sm text-gray-600">{task?.creator_name || '—'}</span>
                </PropRow>
                <PropRow icon={<Clock className="w-3.5 h-3.5 text-gray-400" />} label={t('taskModalCreated')}>
                  <span className="text-sm text-gray-600">
                    {task?.created_at ? format(new Date(task.created_at), 'dd.MM.yyyy HH:mm') : '—'}
                  </span>
                </PropRow>
                {task?.updated_at && task.updated_at !== task.created_at && (
                  <PropRow icon={<Clock className="w-3.5 h-3.5 text-gray-400" />} label={t('taskModalUpdated')}>
                    <span className="text-sm text-gray-600">
                      {format(new Date(task.updated_at), 'dd.MM.yyyy HH:mm')}
                    </span>
                  </PropRow>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Секция Additional Fields (своя свёртка) ──
const AdditionalFieldsSection: React.FC<{
  taskId: number;
  projectId?: number;
  fieldData: import('../hooks/useCustomFields').TaskFieldData;
  projectFields: Array<{
    id: number;
    field_name: string;
    field_type: string;
    field_options?: string;
    is_required: boolean;
    is_active: boolean;
  }>;
  onRowsChange: (rows: import('../hooks/useCustomFields').FieldRow[]) => void;
}> = ({ taskId, projectId, fieldData, projectFields, onRowsChange }) => {
  const { t } = useTranslation('taskManager');
  const [open, setOpen] = React.useState(true);

  const hasFields = taskId === 0 ? projectFields.filter(f => f.is_active).length > 0 : fieldData.fields.length > 0;
  if (!hasFields) return null;

  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 mb-3 group"
      >
        {open
          ? <ChevronDown className="w-4 h-4 transition-transform" />
          : <ChevronRight className="w-4 h-4 transition-transform" />
        }
        <span>{t('taskModalAdditionalFields')}</span>
      </button>

      {open && (
        <CustomFieldsRenderer
          taskId={taskId}
          projectId={projectId}
          fieldData={fieldData}
          projectFields={projectFields}
          onRowsChange={onRowsChange}
          variant="table"
        />
      )}
    </div>
  );
};

// ── Вспомогательный компонент строки свойства ──
const PropRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}> = ({ icon, label, children }) => (
  <div className="flex items-start gap-2 py-2 rounded-md hover:bg-gray-100 px-2 -mx-2 transition-colors group">
    <div className="w-4 h-5 flex items-center justify-center shrink-0 mt-0.5">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-xs font-medium text-gray-400 mb-0.5 uppercase tracking-wide">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  </div>
);

// ── Inline статус-пикер ──
const InlineStatusPicker: React.FC<{
  statuses: any[];
  statusId: number;
  currentStatus: any;
  translateStatus: (s: any) => string;
  onChange: (id: number) => void;
}> = ({ statuses, statusId, currentStatus, translateStatus, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm hover:bg-gray-100 transition-colors"
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: currentStatus?.color || '#9ca3af' }} />
        <span className="font-medium text-gray-700">{currentStatus ? translateStatus(currentStatus) : '—'}</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[160px]">
          {statuses.map((s) => (
            <button key={s.id} onClick={() => { onChange(s.id); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${s.id === statusId ? 'bg-gray-50' : ''}`}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-gray-800">{translateStatus(s)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Inline приоритет-пикер ──
const InlinePriorityPicker: React.FC<{
  priority: string;
  onChange: (v: string) => void;
  t: (k: string) => string;
}> = ({ priority, onChange, t }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const getPriorityLabel = (v: string) => t(`priority${v.charAt(0).toUpperCase() + v.slice(1)}`);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm hover:bg-gray-100 transition-colors"
      >
        <PriorityIcon priority={priority} />
        <span className="font-medium text-gray-700">{getPriorityLabel(priority)}</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[160px]">
          {(['low','medium','high','critical'] as const).map((v) => (
            <button key={v} onClick={() => { onChange(v); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${v === priority ? 'bg-gray-50' : ''}`}>
              <PriorityIcon priority={v} />
              <span className="text-gray-800">{getPriorityLabel(v)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Inline исполнитель-пикер ──
const InlineAssigneePicker: React.FC<{
  projectId: number;
  assigneeId?: number;
  assigneeName?: string;
  members: any[];
  onUpdate: (id: number | undefined) => void;
}> = ({ assigneeId, assigneeName, members, onUpdate }) => {
  const { t } = useTranslation('taskManager');
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const ref = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(''); } };
    if (open) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  // Фокус на поле поиска при открытии
  React.useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
    else setSearch('');
  }, [open]);

  const filtered = members.filter(m =>
    (m.full_name || m.username || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm hover:bg-gray-100 transition-colors"
      >
        {assigneeId && assigneeName ? (
          <>
            <Avatar name={assigneeName} imageUrl={`/avatar_${assigneeId}.png`} size="sm" />
            <span className="font-medium text-gray-700">{assigneeName}</span>
          </>
        ) : (
          <>
            <User className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-gray-400">{t('taskModalAddAssignee')}</span>
          </>
        )}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 w-56">
          {/* Поиск */}
          <div className="px-2 py-1.5 border-b border-gray-100">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('assigneeSelectorSearch')}
              className="w-full px-2 py-1 text-sm bg-gray-50 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-gray-300"
            />
          </div>
          {/* Список */}
          <div className="max-h-52 overflow-y-auto">
            <button onClick={() => { onUpdate(undefined); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
              — {t('assigneeSelectorNotAssigned')}
            </button>
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400">{t('assigneeSelectorMembersNotFound')}</div>
            ) : (
              filtered.map((m) => (
                <button key={m.user_id} onClick={() => { onUpdate(m.user_id); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${m.user_id === assigneeId ? 'bg-gray-50' : ''}`}>
                  <Avatar name={m.full_name || m.username} imageUrl={`/avatar_${m.user_id}.png`} size="sm" />
                  <span className="text-gray-800 truncate">{m.full_name || m.username}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
