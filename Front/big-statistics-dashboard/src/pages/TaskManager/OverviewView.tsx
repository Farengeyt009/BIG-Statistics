import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Users, CalendarClock, AlertTriangle, CircleDashed } from 'lucide-react';
import { useTasks } from './hooks/useTasks';
import { useProjectMembers } from './hooks/useProjectMembers';
import { Avatar } from './components/ui/Avatar';
import { useStatusTranslation } from './hooks/useStatusTranslation';
import { TaskDetailsModal } from './components/TaskDetailsModal';
import TaskManagerTranslation from './TaskManagerTranslation.json';

interface OverviewViewProps {
  projectId: number;
  onMemberClick?: (memberId: number) => void;
}

interface TaskHistoryItem {
  id: number;
  task_id: number;
  task_title: string;
  user_name?: string;
  user_full_name?: string;
  action_type: string;
  field_changed?: string;
  old_value?: string | null;
  new_value?: string | null;
  created_at: string;
}

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function toLocale(lang: string) {
  if (lang.startsWith('zh')) return 'zh-CN';
  if (lang.startsWith('en')) return 'en-US';
  return 'ru-RU';
}

function fmtDateTime(date: string, locale: string) {
  const d = new Date(date);
  return d.toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const OverviewView: React.FC<OverviewViewProps> = ({ projectId, onMemberClick }) => {
  const { t, i18n } = useTranslation('taskManager');
  const { translateStatus } = useStatusTranslation();
  const { tasks, statuses, loading, updateTask, deleteTask } = useTasks(projectId);
  const { members } = useProjectMembers(projectId);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [history, setHistory] = useState<TaskHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const locale = toLocale(i18n.language || 'ru');

  useEffect(() => {
    const lang = i18n.language;
    if (TaskManagerTranslation[lang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(
        lang,
        'taskManager',
        TaskManagerTranslation[lang as keyof typeof TaskManagerTranslation],
        true,
        true
      );
    }
  }, [i18n]);

  const priorityMeta = useMemo(
    () => ({
      critical: { label: t('priorityCritical'), color: 'text-red-600', bg: 'bg-red-50' },
      high: { label: t('priorityHigh'), color: 'text-orange-500', bg: 'bg-orange-50' },
      medium: { label: t('priorityMedium'), color: 'text-yellow-600', bg: 'bg-yellow-50' },
      low: { label: t('priorityLow'), color: 'text-green-600', bg: 'bg-green-50' },
    }),
    [t]
  );

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const rootTasks = useMemo(() => tasks.filter(t => t.parent_task_id == null || t.parent_task_id === 0), [tasks]);

  const finalStatusIds = useMemo(
    () => new Set(statuses.filter(s => s.is_final).map(s => s.id)),
    [statuses]
  );

  const stats = useMemo(() => {
    const total = rootTasks.length;
    const completed = rootTasks.filter(t => finalStatusIds.has(t.status_id)).length;
    const overdue = rootTasks.filter(t =>
      !finalStatusIds.has(t.status_id) && t.due_date && new Date(t.due_date) < today
    ).length;
    // Считаем незавершённые задачи без исполнителя
    const noAssignee = rootTasks.filter(t =>
      !finalStatusIds.has(t.status_id) && (t.assignee_id == null || t.assignee_id === 0)
    ).length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, overdue, noAssignee, progress };
  }, [rootTasks, finalStatusIds, today]);

  // Задачи по статусам (только не-финальные + финальные — всё)
  const statusBreakdown = useMemo(() => {
    const counts: Record<number, number> = {};
    rootTasks.forEach(t => { counts[t.status_id] = (counts[t.status_id] || 0) + 1; });
    return statuses
      .map(s => ({ ...s, count: counts[s.id] || 0 }))
      .filter(s => s.count > 0)
      .sort((a, b) => a.order_index - b.order_index);
  }, [rootTasks, statuses]);

  // Нагрузка по исполнителям (все задачи, включая финальные) + разбивка по статусам для мини-бара
  const workload = useMemo(() => {
    const map: Record<number, {
      name: string;
      count: number;
      overdue: number;
      statusCounts: Record<number, number>;
    }> = {};
    rootTasks
      .filter(t => t.assignee_id)
      .forEach(t => {
        const id = t.assignee_id!;
        if (!map[id]) map[id] = { name: t.assignee_full_name || t.assignee_name || `#${id}`, count: 0, overdue: 0, statusCounts: {} };
        map[id].count++;
        map[id].statusCounts[t.status_id] = (map[id].statusCounts[t.status_id] || 0) + 1;
        if (t.due_date && new Date(t.due_date) < today) map[id].overdue++;
      });
    return Object.entries(map)
      .map(([id, v]) => ({ id: Number(id), ...v }))
      .sort((a, b) => b.count - a.count);
  }, [rootTasks, finalStatusIds, today]);

  

  // Просроченные задачи (топ-7)
  const overdueTasks = useMemo(() =>
    rootTasks
      .filter(t => !finalStatusIds.has(t.status_id) && t.due_date && new Date(t.due_date) < today)
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
      .slice(0, 7),
    [rootTasks, finalStatusIds, today]
  );

  // Задачи со сроком на этой неделе (не просроченные)
  const upcomingTasks = useMemo(() => {
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
    return rootTasks
      .filter(t =>
        !finalStatusIds.has(t.status_id) &&
        t.due_date &&
        new Date(t.due_date) >= today &&
        new Date(t.due_date) <= weekEnd
      )
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
      .slice(0, 7);
  }, [rootTasks, finalStatusIds, today]);

  useEffect(() => {
    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`/api/task-manager/tasks/project/${projectId}/history?limit=12`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json();
        if (data.success) {
          setHistory(data.data || []);
        } else {
          setHistory([]);
        }
      } catch (err) {
        console.error('Error loading history:', err);
        setHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchHistory();
  }, [projectId]);

  const historyActionText = (item: TaskHistoryItem) => {
    if (item.action_type === 'created') return t('overviewActionCreated');
    if (item.action_type === 'status_changed') return t('overviewActionStatusChanged');
    if (item.action_type === 'assigned') return t('overviewActionAssigned');
    if (item.action_type === 'task_deleted') return t('overviewActionTaskDeleted');
    if (item.action_type === 'subtask_created') return t('overviewActionSubtaskCreated');
    if (item.action_type === 'subtask_completed') return t('overviewActionSubtaskCompleted');
    if (item.action_type === 'subtask_deleted') return t('overviewActionSubtaskDeleted');
    if (item.action_type === 'approval_added') return t('overviewActionApprovalAdded');
    if (item.action_type === 'approval_removed') return t('overviewActionApprovalRemoved');
    return t('overviewActionUpdated');
  };

  const formatHistoryValue = (value?: string | null) => {
    const v = value?.toString().trim();
    if (!v) return '';
    if (v.includes(':')) {
      const [, ...parts] = v.split(':');
      const titlePart = parts.join(':').trim();
      return titlePart || v;
    }
    return v;
  };

  const historyDetailsText = (item: TaskHistoryItem) => {
    if (item.action_type === 'approval_removed') return `→ ${t('overviewApprovalRevoked')}`;
    if (item.action_type === 'approval_added' && !item.new_value) return `→ ${t('overviewApproved')}`;

    let oldVal = formatHistoryValue(item.old_value);
    let newVal = formatHistoryValue(item.new_value);

    if (item.field_changed === 'status') {
      oldVal = oldVal ? translateStatus({ name: oldVal }) : oldVal;
      newVal = newVal ? translateStatus({ name: newVal }) : newVal;
    }

    if (!oldVal && newVal) return `→ ${newVal}`;
    if (oldVal && !newVal) return `${oldVal} → ${t('overviewEmptyValue')}`;
    if (oldVal && newVal && oldVal !== newVal) return `${oldVal} → ${newVal}`;
    return '';
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        {t('loadingProjects')}
      </div>
    );
  }

  if (rootTasks.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-8">
        <CircleDashed className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-sm text-gray-400">{t('overviewNoTasks')}</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">

        {/* ── KPI + Project progress в одной карточке ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5">
          <div className="grid grid-cols-4 gap-6">
            <StatCard label={t('overviewTotalTasks')} value={stats.total} />
            <StatCard label={t('overviewCompleted')} value={stats.completed}
              badge={{ text: `${stats.progress}%`, color: 'green' }} />
            <StatCard label={t('overviewOverdue')} value={stats.overdue}
              badge={stats.overdue > 0 ? { text: t('overviewNeedsAttention'), color: 'red' } : { text: t('overviewAllOnTime'), color: 'green' }} />
            <StatCard label={t('overviewNoAssignee')} value={stats.noAssignee}
              badge={stats.noAssignee > 0 ? { text: t('overviewAssignNow'), color: 'orange' } : { text: t('overviewAllAssigned'), color: 'green' }} />
          </div>

          <div className="mt-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">{t('overviewProjectProgress')}</span>
            </div>

            {/* Сегментированный бар */}
            <div className="w-full h-3 rounded-full overflow-hidden flex gap-px bg-gray-100">
              {statusBreakdown.map(s => (
                <div
                  key={s.id}
                  className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full opacity-80"
                  style={{
                    width: `${(s.count / stats.total) * 100}%`,
                    backgroundColor: s.color,
                    minWidth: s.count > 0 ? '4px' : '0',
                  }}
                  title={`${translateStatus(s)}: ${s.count}`}
                />
              ))}
            </div>

            {/* Легенда под баром */}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
              {statusBreakdown.map(s => (
                <div key={s.id} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0 opacity-75" style={{ backgroundColor: s.color }} />
                  <span className="text-xs text-gray-600">{translateStatus(s)}</span>
                  <span className="text-xs font-semibold text-gray-800">{s.count}</span>
                  <span className="text-xs text-gray-400">{Math.round((s.count / stats.total) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Широкие карточки в порядке: Overdue → Due this week → Team workload ── */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <h3 className="text-sm font-semibold text-gray-800">{t('overviewOverdueTasks')}</h3>
            </div>

            {overdueTasks.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">{t('overviewAllOnTime')}</p>
            ) : (
              <TaskInfoTable
                tasks={overdueTasks}
                statuses={statuses}
                translateStatus={translateStatus}
                priorityMeta={priorityMeta}
                t={t}
                onTaskClick={setSelectedTask}
              />
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700">{t('overviewDueThisWeek')}</h3>
            </div>

            {upcomingTasks.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">{t('listViewNoTasks')}</p>
            ) : (
              <TaskInfoTable
                tasks={upcomingTasks}
                statuses={statuses}
                translateStatus={translateStatus}
                priorityMeta={priorityMeta}
                t={t}
                onTaskClick={setSelectedTask}
              />
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700">{t('overviewTeamWorkload')}</h3>
            </div>
            {workload.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">{t('overviewNoOpenAssignedTasks')}</p>
            ) : (
              <div className="space-y-2.5">
                {workload.map(w => {
                  const member = members.find(m => m.user_id === w.id);
                  return (
                    <div key={w.id}>
                      <button
                        type="button"
                        onClick={() => onMemberClick?.(w.id)}
                        className="w-full flex items-center gap-2 mb-1 rounded-md px-1 py-0.5 hover:bg-gray-50 transition-colors text-left"
                      >
                        <Avatar
                          name={member?.full_name || w.name}
                          imageUrl={`/avatar_${w.id}.png`}
                          size="sm"
                        />
                        <span className="text-xs text-gray-600 flex-1 truncate">{w.name}</span>
                        <div className="flex items-center gap-1.5">
                          {w.overdue > 0 && (
                            <span className="text-[10px] font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                              {w.overdue} {t('overviewOverdueShort')}
                            </span>
                          )}
                          <span className="text-xs font-semibold text-gray-700">{w.count}</span>
                        </div>
                      </button>
                      <div className="w-full h-1.5 rounded-full overflow-hidden flex gap-px bg-gray-100">
                        {statuses
                          .filter(s => (w.statusCounts[s.id] || 0) > 0)
                          .sort((a, b) => a.order_index - b.order_index)
                          .map(s => (
                            <div
                              key={s.id}
                              className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300 opacity-75"
                              style={{
                                width: `${Math.round((w.statusCounts[s.id] / w.count) * 100)}%`,
                                backgroundColor: s.color,
                                minWidth: '3px',
                              }}
                              title={`${translateStatus(s)}: ${w.statusCounts[s.id]}`}
                            />
                          ))
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── История изменений ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">{t('overviewHistoryTitle')}</h3>
          </div>

          {historyLoading ? (
            <p className="text-xs text-gray-400">{t('overviewHistoryLoading')}</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-gray-400">{t('overviewHistoryEmpty')}</p>
          ) : (
            <div className="space-y-2">
              {history.map(item => {
                const details = historyDetailsText(item);
                return (
                  <div key={item.id} className="flex items-start justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-800 truncate">
                        <span className="font-semibold">{item.user_full_name || item.user_name || t('overviewUserFallback')}</span>
                        {' '}
                        {historyActionText(item)}
                        {' '}
                        <span className="font-semibold">#{item.task_id}</span>
                        {' '}
                        <span className="text-gray-600">({item.task_title})</span>
                      </p>
                      {details && (
                        <p className="text-[11px] text-gray-500 mt-0.5 truncate">{details}</p>
                      )}
                    </div>
                    <span className="shrink-0 text-[11px] text-gray-400 whitespace-nowrap">
                      {fmtDateTime(item.created_at, locale)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
              void updateTask(taskId, { status_id: newStatusId });
            }}
          />
        )}

      </div>
    </div>
  );
};

/* ── Вспомогательный компонент карточки (стиль MetricCard) ── */
interface StatCardProps {
  label: string;
  value: number;
  badge?: { text: string; color: 'green' | 'orange' | 'red' };
}

const BADGE_STYLES = {
  green:  { text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
  orange: { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
  red:    { text: 'text-rose-600',  bg: 'bg-rose-50',  border: 'border-rose-100' },
};

const StatCard: React.FC<StatCardProps> = ({ label, value, badge }) => {
  const b = badge ? BADGE_STYLES[badge.color] : null;
  return (
    <div className="flex flex-col justify-start px-4 border-r border-gray-100 last:border-r-0">
      <div className="font-bold text-xs whitespace-nowrap text-base800">{label}</div>
      <div className="font-bold text-base36 leading-[1.5] whitespace-nowrap text-base900">{value}</div>
      {b && (
        <div className={`flex items-center font-bold text-xs py-[0.1em] px-[0.5em] rounded-[5px] border self-start ${b.text} ${b.bg} ${b.border}`}>
          {badge!.text}
        </div>
      )}
    </div>
  );
};

interface TaskInfoTableProps {
  tasks: any[];
  statuses: any[];
  translateStatus: (status: any) => string;
  priorityMeta: Record<string, { label: string; color: string; bg: string }>;
  t: (key: string) => string;
  onTaskClick?: (task: any) => void;
}

const TaskInfoTable: React.FC<TaskInfoTableProps> = ({
  tasks,
  statuses,
  translateStatus,
  priorityMeta,
  t,
  onTaskClick,
}) => {
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-3 px-3 py-2 bg-gray-50 border-b border-gray-100">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t('listViewColumnTask')}</div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t('listViewColumnStatus')}</div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t('bulkPriority')}</div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t('bulkAssignee')}</div>
      </div>

      <div>
        {tasks.map((task) => {
          const p = priorityMeta[task.priority as keyof typeof priorityMeta] || priorityMeta.medium;
          const status = statuses.find((s: any) => s.id === task.status_id);
          const assignee = task.assignee_full_name || task.assignee_name || t('assigneeSelectorNotAssigned');
          return (
            <div
              key={task.id}
              className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-3 px-3 py-2.5 border-b border-gray-50 last:border-b-0 items-center cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => onTaskClick?.(task)}
            >
              <div className="min-w-0 flex items-center gap-2">
                <span className="text-xs text-gray-400 font-medium shrink-0">#{task.id}</span>
                <span className="text-sm text-gray-800 font-medium truncate">{task.title}</span>
              </div>

              <div className="min-w-0">
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 px-2 py-1 rounded-md border border-gray-200 max-w-full"
                  style={{ borderColor: status?.color ? `${status.color}55` : undefined }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: status?.color || '#9ca3af' }}
                  />
                  <span className="truncate">{translateStatus(status || { name: task.status_name || '' })}</span>
                </span>
              </div>

              <div className="min-w-0">
                <span className={`inline-flex items-center text-xs font-semibold px-2 py-1 rounded ${p.bg} ${p.color}`}>
                  {p.label}
                </span>
              </div>

              <div className="min-w-0 flex items-center gap-2">
                {task.assignee_id ? (
                  <Avatar name={assignee} imageUrl={`/avatar_${task.assignee_id}.png`} size="sm" />
                ) : (
                  <span className="w-6 h-6 rounded-full bg-gray-100 border border-gray-200 shrink-0" />
                )}
                <span className="text-xs text-gray-700 truncate">{assignee}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
