import React, { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, UserCircle2, Trash2, X, ChevronDown, Download } from 'lucide-react';
import { useTasks } from './hooks/useTasks';
import { useStatusTranslation } from './hooks/useStatusTranslation';
import { useProjectMembers } from './hooks/useProjectMembers';
import { TaskDetailsModal } from './components/TaskDetailsModal';
import { StatusSelector } from './components/StatusSelector';
import { SortOption } from './components/SortSelector';
import { PriorityIcon, PrioritySelector } from './components/PrioritySelector';
import { Avatar } from './components/ui/Avatar';
import { format } from 'date-fns';
import { TaskFilters, EMPTY_FILTERS, applyFilters } from './types/filters';
import { ToastContainer } from './components/Toast';
import { useErrorTranslation } from './hooks/useErrorTranslation';
import TaskManagerTranslation from './TaskManagerTranslation.json';

interface ListViewProps {
  projectId: number;
  refreshKey?: number;
  createTrigger?: number;
  sortBy?: SortOption;
  hideCompleted?: boolean;
  userRole?: string;
  filters?: TaskFilters;
  onExport?: (selectedIds: number[]) => void;
}

const priorityOrder: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const priorityConfig = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export const ListView: React.FC<ListViewProps> = ({
  projectId,
  refreshKey,
  createTrigger,
  sortBy: sortByProp,
  hideCompleted: hideCompletedProp,
  userRole = 'member',
  filters = EMPTY_FILTERS,
  onExport,
}) => {
  const { t, i18n } = useTranslation('taskManager');
  const { translateStatus } = useStatusTranslation();
  const { translateError } = useErrorTranslation();
  const { tasks, statuses, loading, updateTask, deleteTask, createTask, fetchTasks, fetchStatuses } = useTasks(projectId);
  const { members } = useProjectMembers(projectId);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'error' | 'success' | 'warning' }>>([]);

  const showToast = (message: string, type: 'error' | 'success' | 'warning' = 'error') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };
  const removeToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));
  const [collapsedStatuses, setCollapsedStatuses] = useState<Set<number>>(new Set());
  const sortBy = sortByProp ?? 'priority';
  const hideCompleted = hideCompletedProp ?? false;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedStatusId, setSelectedStatusId] = useState<number | null>(null);

  // Assignee inline dropdown
  const [assigneeDropdownTaskId, setAssigneeDropdownTaskId] = useState<number | null>(null);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const assigneeDropdownRef = useRef<HTMLDivElement>(null);
  const assigneeSearchRef = useRef<HTMLInputElement>(null);
  const dateInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Multi-select
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());
  const hasSelection = selectedTaskIds.size > 0;
  const canDelete = userRole === 'owner' || userRole === 'admin';

  // Bulk action dropdowns
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkPriorityOpen, setBulkPriorityOpen] = useState(false);
  const [bulkAssigneeOpen, setBulkAssigneeOpen] = useState(false);
  const [bulkAssigneeSearch, setBulkAssigneeSearch] = useState('');
  const bulkStatusRef = useRef<HTMLDivElement>(null);
  const bulkPriorityRef = useRef<HTMLDivElement>(null);
  const bulkAssigneeRef = useRef<HTMLDivElement>(null);
  const bulkDueDateRef = useRef<HTMLInputElement>(null);
  const bulkStartDateRef = useRef<HTMLInputElement>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Close assignee dropdown on outside click
  React.useEffect(() => {
    const h = (e: MouseEvent) => {
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(e.target as Node)) {
        setAssigneeDropdownTaskId(null);
        setAssigneeSearch('');
      }
    };
    if (assigneeDropdownTaskId !== null) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [assigneeDropdownTaskId]);

  React.useEffect(() => {
    if (assigneeDropdownTaskId !== null) setTimeout(() => assigneeSearchRef.current?.focus(), 50);
    else setAssigneeSearch('');
  }, [assigneeDropdownTaskId]);

  // Close bulk dropdowns on outside click
  React.useEffect(() => {
    const h = (e: MouseEvent) => {
      if (bulkStatusRef.current && !bulkStatusRef.current.contains(e.target as Node)) setBulkStatusOpen(false);
      if (bulkPriorityRef.current && !bulkPriorityRef.current.contains(e.target as Node)) setBulkPriorityOpen(false);
      if (bulkAssigneeRef.current && !bulkAssigneeRef.current.contains(e.target as Node)) { setBulkAssigneeOpen(false); setBulkAssigneeSearch(''); }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Load translations
  React.useEffect(() => {
    const currentLang = i18n.language;
    if (TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(currentLang, 'taskManager', TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);

  const toggleStatusCollapse = (statusId: number) => {
    setCollapsedStatuses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(statusId)) newSet.delete(statusId);
      else newSet.add(statusId);
      return newSet;
    });
  };

  React.useEffect(() => {
    if (refreshKey && refreshKey > 0) fetchStatuses();
  }, [refreshKey, fetchStatuses]);

  React.useEffect(() => {
    if (createTrigger && createTrigger > 0) {
      setSelectedStatusId(statuses[0]?.id || null);
      setShowCreateModal(true);
    }
  }, [createTrigger]);

  const sortTasks = (tasksToSort: any[]) => {
    return [...tasksToSort].sort((a, b) => {
      switch (sortBy) {
        case 'priority': return priorityOrder[a.priority] - priorityOrder[b.priority];
        case 'created': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'updated': return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        case 'title': return a.title.localeCompare(b.title);
        case 'dueDate':
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        default: return 0;
      }
    });
  };

  const tasksByStatus = useMemo(() => {
    return statuses
      .filter((status) => !hideCompleted || !status.is_final)
      .map((status) => ({
        status,
        tasks: sortTasks(applyFilters(tasks.filter((t) => t.status_id === status.id), filters)),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, statuses, sortBy, hideCompleted, filters]);

  const allVisibleTaskIds = useMemo(() =>
    tasksByStatus.flatMap(({ tasks }) => tasks.map((t: any) => t.id)),
    [tasksByStatus]
  );

  // Toggle single task selection
  const toggleTaskSelection = (taskId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  // Toggle all tasks in a status group
  const toggleGroupSelection = (groupTaskIds: number[], e: React.MouseEvent) => {
    e.stopPropagation();
    const allSelected = groupTaskIds.every(id => selectedTaskIds.has(id));
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (allSelected) groupTaskIds.forEach(id => next.delete(id));
      else groupTaskIds.forEach(id => next.add(id));
      return next;
    });
  };

  // Bulk update all selected tasks
  const bulkUpdate = async (updates: Record<string, any>) => {
    setBulkProcessing(true);
    await Promise.all([...selectedTaskIds].map(id => updateTask(id, updates)));
    setBulkProcessing(false);
  };

  const bulkDeleteSelected = async () => {
    if (!window.confirm(t('bulkDeleteConfirm'))) return;
    setBulkProcessing(true);
    await Promise.all([...selectedTaskIds].map(id => deleteTask(id)));
    setSelectedTaskIds(new Set());
    setBulkProcessing(false);
  };

  const renderApprovalIndicator = (task: any) => (
    <span
      className={`text-xs px-1.5 py-0.5 rounded shrink-0 font-semibold leading-none ${
        task.has_approval_requirement && task.approval_conditions_met
          ? 'bg-green-100'
          : 'bg-gray-100'
      } ${
        task.has_approval_requirement && task.approval_current_user_approved
          ? 'text-green-600'
          : 'text-gray-400'
      }`}
      title={
        task.has_approval_requirement
          ? (task.approval_conditions_met ? 'Approval condition met' : 'Approval condition pending')
          : 'No approval required'
      }
    >
      ✓
    </span>
  );

  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{t('listViewLoading')}</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white relative">
      {/* Список задач */}
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: hasSelection ? '64px' : '0' }}>
        {tasksByStatus.map(({ status, tasks: statusTasks }) => {
          const groupTaskIds = statusTasks.map((t: any) => t.id);
          const allGroupSelected = groupTaskIds.length > 0 && groupTaskIds.every((id: number) => selectedTaskIds.has(id));
          const someGroupSelected = groupTaskIds.some((id: number) => selectedTaskIds.has(id));

          return (
            <div key={status.id}>
              {/* Заголовок группы */}
              <div
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors sticky top-0 z-10 group/header"
                onClick={() => toggleStatusCollapse(status.id)}
              >
                {/* Group checkbox */}
                <div
                  className={`w-4 h-4 shrink-0 flex items-center justify-center transition-opacity ${hasSelection || someGroupSelected ? 'opacity-100' : 'opacity-0 group-hover/header:opacity-100'}`}
                  onClick={(e) => toggleGroupSelection(groupTaskIds, e)}
                >
                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                    allGroupSelected ? 'bg-blue-600 border-blue-600' :
                    someGroupSelected ? 'bg-blue-100 border-blue-400' :
                    'border-gray-400 hover:border-blue-500'
                  }`}>
                    {allGroupSelected && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    {someGroupSelected && !allGroupSelected && <div className="w-1.5 h-0.5 bg-blue-500 rounded" />}
                  </div>
                </div>

                <svg
                  className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-150 ${collapsedStatuses.has(status.id) ? '' : 'rotate-90'}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
                <span className="text-sm font-semibold text-gray-700">{translateStatus(status)}</span>
                <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full font-medium">
                  {statusTasks.length}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedStatusId(status.id);
                    setShowCreateModal(true);
                  }}
                  className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded text-xs text-gray-400 hover:text-gray-900 hover:bg-gray-200 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              {/* Строки задач */}
              {!collapsedStatuses.has(status.id) && (
                <div>
                  {statusTasks.map((task: any) => {
                    const isSelected = selectedTaskIds.has(task.id);
                    return (
                      <div
                        key={task.id}
                        onClick={() => !hasSelection && setSelectedTask(task)}
                        className={`flex items-center px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors group ${
                          isSelected ? 'bg-blue-50 hover:bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        {/* Checkbox */}
                        <div
                          className={`w-5 shrink-0 flex items-center justify-center mr-1 transition-opacity ${hasSelection || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                          onClick={(e) => toggleTaskSelection(task.id, e)}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-all ${
                            isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 hover:border-blue-500'
                          }`}>
                            {isSelected && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                        </div>

                        {/* Основной контент строки: больше места названию + равномерные колонки справа */}
                        <div className="flex-1 min-w-0 ml-12 grid grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-4">
                          {/* Название */}
                          <div className="min-w-0 flex items-center gap-2">
                            <span className="text-xs text-gray-400 font-medium shrink-0">#{task.id}</span>
                            <span className="text-sm font-medium text-gray-900 truncate flex-1 min-w-0">{task.title}</span>
                            {task.tags && task.tags.map((tag: any) => (
                              <span
                                key={tag.id}
                                className="hidden group-hover:inline text-xs px-1.5 py-0.5 rounded font-medium shrink-0"
                                style={{
                                  backgroundColor: `${tag.color}18`,
                                  color: tag.color,
                                  border: `1px solid ${tag.color}35`,
                                }}
                              >
                                {tag.name}
                              </span>
                            ))}
                          </div>

                          {/* Статус */}
                          <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
                            <StatusSelector
                              status={{ id: task.status_id, name: task.status_name, color: task.status_color }}
                              statuses={statuses}
                              taskId={task.id}
                              onUpdate={(statusId) => { void updateTask(task.id, { status_id: statusId }); }}
                              onError={(msg) => showToast(translateError(msg))}
                            />
                          </div>

                          {/* Легенда */}
                          <div className="min-w-0 pl-3 border-l border-gray-200 flex items-center gap-2 text-gray-400">
                            {renderApprovalIndicator(task)}
                            {task.subtask_count > 0 && (
                              <span className="flex items-center gap-0.5 text-xs">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                </svg>
                                <span className="font-medium">{task.subtask_count}</span>
                              </span>
                            )}
                            {task.comment_count > 0 && (
                              <span className="flex items-center gap-0.5 text-xs">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                <span className="font-medium">{task.comment_count}</span>
                              </span>
                            )}
                            {task.attachment_count > 0 && (
                              <span className="flex items-center gap-0.5 text-xs">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                                <span className="font-medium">{task.attachment_count}</span>
                              </span>
                            )}
                          </div>

                          {/* Приоритет */}
                          <div className="min-w-0 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                            <PrioritySelector
                              priority={(task.priority as 'low' | 'medium' | 'high' | 'critical') || 'medium'}
                              taskId={task.id}
                              onUpdate={(priority) => {
                                void updateTask(task.id, { priority: priority as 'low' | 'medium' | 'high' | 'critical' });
                              }}
                            />
                          </div>

                          {/* Дедлайн */}
                          <div className="min-w-0 flex items-center relative" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                const el = dateInputRefs.current[task.id];
                                if (!el) return;
                                if (typeof (el as any).showPicker === 'function') (el as any).showPicker();
                                else { el.focus(); el.click(); }
                              }}
                              className="group/datebtn flex items-center gap-1.5 rounded-md hover:bg-gray-100 px-1.5 py-1 transition-colors min-w-0"
                            >
                              {task.due_date ? (
                                <>
                                  <Calendar className={`w-4 h-4 shrink-0 ${new Date(task.due_date) < new Date() ? 'text-red-300' : 'text-gray-400'}`} />
                                  <span className={`text-xs font-semibold truncate ${new Date(task.due_date) < new Date() ? 'text-red-400' : 'text-gray-600'}`}>
                                    {format(new Date(task.due_date), 'dd MMM yyyy')}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Calendar className="w-4 h-4 text-gray-300 group-hover/datebtn:text-gray-500 transition-colors" />
                                  <span className="text-xs text-gray-300 group-hover/datebtn:text-gray-500 transition-colors truncate">{t('taskModalDueDate')}</span>
                                </>
                              )}
                            </button>
                            <input
                              ref={(el) => { dateInputRefs.current[task.id] = el; }}
                              type="date"
                              value={task.due_date ? task.due_date.split('T')[0] : ''}
                              onChange={(e) => { void updateTask(task.id, { due_date: e.target.value || undefined }); }}
                              className="absolute bottom-0 left-0 w-0 h-0 opacity-0 border-0 p-0"
                              tabIndex={-1}
                            />
                          </div>

                          {/* Исполнитель */}
                          <div
                            className="min-w-0 flex items-center gap-2 relative"
                            onClick={(e) => e.stopPropagation()}
                            ref={assigneeDropdownTaskId === task.id ? assigneeDropdownRef : undefined}
                          >
                            <button
                              onClick={() => setAssigneeDropdownTaskId(assigneeDropdownTaskId === task.id ? null : task.id)}
                              className="group/assigneebtn flex items-center gap-1.5 rounded-md hover:bg-gray-100 px-1.5 py-1 transition-colors min-w-0"
                            >
                              {task.assignee_id && task.assignee_name ? (
                                <>
                                  <Avatar name={task.assignee_name} imageUrl={`/avatar_${task.assignee_id}.png`} size="sm" />
                                  <span className="text-xs text-gray-600 truncate">{task.assignee_name}</span>
                                </>
                              ) : (
                                <>
                                  <UserCircle2 className="w-4 h-4 text-gray-300 group-hover/assigneebtn:text-gray-500 transition-colors" />
                                  <span className="text-xs text-gray-300 group-hover/assigneebtn:text-gray-500 transition-colors truncate">{t('taskModalAddAssignee')}</span>
                                </>
                              )}
                            </button>
                            {assigneeDropdownTaskId === task.id && (
                              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 w-56">
                                <div className="px-2 py-1.5 border-b border-gray-100">
                                  <input
                                    ref={assigneeSearchRef}
                                    type="text"
                                    value={assigneeSearch}
                                    onChange={e => setAssigneeSearch(e.target.value)}
                                    placeholder={t('assigneeSelectorSearch')}
                                    className="w-full px-2 py-1 text-sm bg-gray-50 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-gray-300"
                                  />
                                </div>
                                <div className="max-h-52 overflow-y-auto">
                                  <button
                                    onClick={() => { void updateTask(task.id, { assignee_id: undefined }); setAssigneeDropdownTaskId(null); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                                  >
                                    — {t('assigneeSelectorNotAssigned')}
                                  </button>
                                  {members
                                    .filter(m => (m.full_name || m.username || '').toLowerCase().includes(assigneeSearch.toLowerCase()))
                                    .map((m) => (
                                      <button
                                        key={m.user_id}
                                        onClick={() => { void updateTask(task.id, { assignee_id: m.user_id }); setAssigneeDropdownTaskId(null); }}
                                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${m.user_id === task.assignee_id ? 'bg-gray-50' : ''}`}
                                      >
                                        <Avatar name={m.full_name || m.username} imageUrl={`/avatar_${m.user_id}.png`} size="sm" />
                                        <span className="text-gray-800 truncate">{m.full_name || m.username}</span>
                                      </button>
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {statusTasks.length === 0 && (
                    <div className="flex items-center px-4 py-3 text-xs text-gray-400 border-b border-gray-100">
                      <div className="w-5 shrink-0 mr-1" />
                      <div className="flex-1 min-w-0 ml-12">
                        {t('listViewNoTasks')}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Bulk Action Toolbar ── */}
      {hasSelection && (
        <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center gap-2 px-4 py-3 bg-white text-gray-700 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] border-t border-gray-200">
          {/* Count */}
          <span className="text-sm font-semibold text-gray-800 shrink-0">
            {selectedTaskIds.size} {t('bulkSelected')}
          </span>

          <div className="h-4 w-px bg-gray-200 mx-1" />

          {/* Status */}
          <div className="relative" ref={bulkStatusRef}>
            <button
              onClick={() => { setBulkStatusOpen(!bulkStatusOpen); setBulkPriorityOpen(false); setBulkAssigneeOpen(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-sm text-gray-700 transition-colors"
            >
              {t('bulkStatus')} <ChevronDown className="w-3.5 h-3.5 opacity-50" />
            </button>
            {bulkStatusOpen && (
              <div className="absolute bottom-full mb-2 left-0 bg-white border border-gray-200 rounded-md shadow-xl z-30 w-48 py-1">
                {statuses.map(s => (
                  <button
                    key={s.id}
                    onClick={async () => { await bulkUpdate({ status_id: s.id }); setBulkStatusOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    {translateStatus(s)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Priority */}
          <div className="relative" ref={bulkPriorityRef}>
            <button
              onClick={() => { setBulkPriorityOpen(!bulkPriorityOpen); setBulkStatusOpen(false); setBulkAssigneeOpen(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-sm text-gray-700 transition-colors"
            >
              {t('bulkPriority')} <ChevronDown className="w-3.5 h-3.5 opacity-50" />
            </button>
            {bulkPriorityOpen && (
              <div className="absolute bottom-full mb-2 left-0 bg-white border border-gray-200 rounded-md shadow-xl z-30 w-40 py-1">
                {priorityConfig.map(p => (
                  <button
                    key={p.value}
                    onClick={async () => { await bulkUpdate({ priority: p.value }); setBulkPriorityOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <PriorityIcon priority={p.value} />
                    {t(`priority${p.value.charAt(0).toUpperCase() + p.value.slice(1)}`)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Due date */}
          <div className="relative">
            <button
              onClick={() => {
                if (typeof (bulkDueDateRef.current as any)?.showPicker === 'function') (bulkDueDateRef.current as any).showPicker();
                else bulkDueDateRef.current?.focus();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-sm text-gray-700 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              {t('bulkDueDate')}
            </button>
            <input
              ref={bulkDueDateRef}
              type="date"
              onChange={async (e) => { if (e.target.value) await bulkUpdate({ due_date: e.target.value }); e.target.value = ''; }}
              className="absolute bottom-0 left-0 w-0 h-0 opacity-0 border-0 p-0"
              tabIndex={-1}
            />
          </div>

          {/* Start date */}
          <div className="relative">
            <button
              onClick={() => {
                if (typeof (bulkStartDateRef.current as any)?.showPicker === 'function') (bulkStartDateRef.current as any).showPicker();
                else bulkStartDateRef.current?.focus();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-sm text-gray-700 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              {t('bulkStartDate')}
            </button>
            <input
              ref={bulkStartDateRef}
              type="date"
              onChange={async (e) => { if (e.target.value) await bulkUpdate({ start_date: e.target.value }); e.target.value = ''; }}
              className="absolute bottom-0 left-0 w-0 h-0 opacity-0 border-0 p-0"
              tabIndex={-1}
            />
          </div>

          {/* Assignee */}
          <div className="relative" ref={bulkAssigneeRef}>
            <button
              onClick={() => { setBulkAssigneeOpen(!bulkAssigneeOpen); setBulkStatusOpen(false); setBulkPriorityOpen(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-sm text-gray-700 transition-colors"
            >
              <UserCircle2 className="w-3.5 h-3.5 text-gray-400" />
              {t('bulkAssignee')} <ChevronDown className="w-3.5 h-3.5 opacity-50" />
            </button>
            {bulkAssigneeOpen && (
              <div className="absolute bottom-full mb-2 left-0 bg-white border border-gray-200 rounded-md shadow-xl z-30 w-56">
                <div className="px-2 py-1.5 border-b border-gray-100">
                  <input
                    autoFocus
                    type="text"
                    value={bulkAssigneeSearch}
                    onChange={e => setBulkAssigneeSearch(e.target.value)}
                    placeholder={t('assigneeSelectorSearch')}
                    className="w-full px-2 py-1 text-sm bg-gray-50 border border-gray-200 rounded outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="max-h-52 overflow-y-auto">
                  <button
                    onClick={async () => { await bulkUpdate({ assignee_id: null }); setBulkAssigneeOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    — {t('assigneeSelectorNotAssigned')}
                  </button>
                  {members
                    .filter(m => (m.full_name || m.username || '').toLowerCase().includes(bulkAssigneeSearch.toLowerCase()))
                    .map(m => (
                      <button
                        key={m.user_id}
                        onClick={async () => { await bulkUpdate({ assignee_id: m.user_id }); setBulkAssigneeOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Avatar name={m.full_name || m.username} imageUrl={`/avatar_${m.user_id}.png`} size="sm" />
                        <span className="truncate">{m.full_name || m.username}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1" />

          {/* Export selected */}
          {onExport && (
            <button
              onClick={() => onExport(Array.from(selectedTaskIds))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-sm text-gray-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-gray-400" />
              {t('exportExcel')}
            </button>
          )}

          {/* Delete (admin/owner only) */}
          {canDelete && (
            <button
              onClick={bulkDeleteSelected}
              disabled={bulkProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-200 bg-red-50 hover:bg-red-100 text-sm text-red-600 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t('bulkDelete')}
            </button>
          )}

          {/* Deselect */}
          <button
            onClick={() => setSelectedTaskIds(new Set())}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-sm text-gray-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            {t('bulkDeselectAll')}
          </button>
        </div>
      )}

      {selectedTask && (
        <TaskDetailsModal
          task={selectedTask}
          statuses={statuses}
          onClose={() => setSelectedTask(null)}
          onUpdate={async (updates) => {
            await updateTask(selectedTask.id, updates);
            setSelectedTask(null);
          }}
          onDelete={async () => {
            await deleteTask(selectedTask.id);
            setSelectedTask(null);
          }}
          onTaskAutoTransitioned={(taskId, newStatusId) => {
            updateTask(taskId, { status_id: newStatusId });
          }}
        />
      )}

      {showCreateModal && (
        <TaskDetailsModal
          mode="create"
          projectId={projectId}
          initialStatusId={selectedStatusId || statuses[0]?.id || 0}
          statuses={statuses}
          onClose={() => setShowCreateModal(false)}
          onCreate={async (taskData) => {
            try {
              const result = await createTask(taskData);
              if (result) setShowCreateModal(false);
              return result;
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : 'Неизвестная ошибка';
              showToast(translateError(errorMsg), 'error');
              return null;
            }
          }}
        />
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};
