import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkflow } from '../hooks/useWorkflow';
import { TransitionsEditor } from './TransitionsEditor';
import { WorkflowSettings } from './WorkflowSettings';
import { useStatusPermissions } from '../hooks/useStatusPermissions';
import { useProjectMembers } from '../hooks/useProjectMembers';
import { useDepartments } from '../hooks/useDepartments';
import { Avatar } from './ui/Avatar';
import TaskManagerTranslation from '../TaskManagerTranslation.json';
import { useStatusTranslation } from '../hooks/useStatusTranslation';
import { fetchJsonGetDedup, invalidateGetDedup } from '../../../utils/fetchDedup';

type StatusGroup = 'new' | 'in_progress' | 'done' | 'canceled';

interface WorkflowEditorProps {
  projectId: number;
  onStatusChange?: () => void;
  mode?: 'all' | 'states' | 'rules';
}

const GROUP_ORDER: StatusGroup[] = ['new', 'in_progress', 'done', 'canceled'];

const GROUP_COLORS: Record<StatusGroup, { dot: string; badge: string; ring: string }> = {
  new:         { dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700 border border-blue-200',          ring: 'ring-blue-300'    },
  in_progress: { dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700 border border-amber-200',       ring: 'ring-amber-300'   },
  done:        { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200', ring: 'ring-emerald-300' },
  canceled:    { dot: 'bg-red-400',     badge: 'bg-red-50 text-red-700 border border-red-200',             ring: 'ring-red-300'     },
};

// Large palette of visually distinct, pleasant colors
const COLOR_PALETTE = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#64748b', '#7c3aed', '#db2777', '#b45309', '#047857',
  '#0369a1', '#4338ca', '#be185d', '#b91c1c', '#15803d',
  '#1d4ed8', '#0891b2', '#059669', '#d97706', '#7e22ce',
];

function pickUniqueColor(usedColors: string[]): string {
  const used = new Set(usedColors.map((c) => c.toLowerCase()));
  const available = COLOR_PALETTE.filter((c) => !used.has(c));
  if (available.length === 0) {
    // All used — pick random from full palette
    return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
  }
  return available[Math.floor(Math.random() * available.length)];
}

export const WorkflowEditor: React.FC<WorkflowEditorProps> = ({
  projectId,
  onStatusChange,
  mode = 'all',
}) => {
  const { t, i18n } = useTranslation('taskManager');
  const { translateStatus } = useStatusTranslation();
  const { statuses, loading, fetchStatuses, createStatus, updateStatus, deleteStatus } = useWorkflow(projectId);
  const { data: permData, fetch: fetchPerms, setToggle, savePermission, deletePermission } = useStatusPermissions(projectId);
  const { members } = useProjectMembers(projectId);
  const { departments, getDeptName } = useDepartments();

  // Creation restriction state
  const [creationRestriction, setCreationRestriction] = useState(false);
  const [creationRestrictionLoading, setCreationRestrictionLoading] = useState(false);

  const fetchCreationRestriction = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const data = await fetchJsonGetDedup<any>(
        `/api/task-manager/workflow/creation-restriction/${projectId}`,
        token,
        500
      );
      if (data.success) setCreationRestriction(!!data.enabled);
    } catch { /* ignore */ }
  };

  const toggleCreationRestriction = async (enabled: boolean) => {
    setCreationRestrictionLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`/api/task-manager/workflow/creation-restriction/${projectId}/toggle`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || 'saveError');
      }
      invalidateGetDedup(`/api/task-manager/workflow/creation-restriction/${projectId}`, token);
      setCreationRestriction(enabled);
    } catch {
      // Возвращаем состояние с сервера, если локальное переключение не сохранилось
      await fetchCreationRestriction();
    } finally {
      setCreationRestrictionLoading(false);
    }
  };

  const toggleStatusIsInitial = async (statusId: number, isInitial: boolean) => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`/api/task-manager/workflow/creation-restriction/${projectId}/status/${statusId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_initial: isInitial }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || 'saveError');
      }
      invalidateGetDedup(`/api/task-manager/workflow/projects/${projectId}/statuses`, token);
      invalidateGetDedup(`/api/task-manager/workflow/creation-restriction/${projectId}`, token);
      await fetchStatuses();
    } catch {
      await fetchStatuses();
    }
  };

  const [editingStatusId, setEditingStatusId] = useState<number | null>(null);
  const [creatingInGroup, setCreatingInGroup] = useState<StatusGroup | null>(null);
  const [statusName, setStatusName] = useState('');
  const [statusColor, setStatusColor] = useState('#3b82f6');
  const [editingGroup, setEditingGroup] = useState<StatusGroup>('in_progress');
  const [statusIsInitial, setStatusIsInitial] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Status permissions drawer state
  const [permDrawerStatusId, setPermDrawerStatusId] = useState<number | null>(null);
  const [permSelectedUsers, setPermSelectedUsers] = useState<number[]>([]);
  const [permSelectedDepts, setPermSelectedDepts] = useState<number[]>([]);
  const [permUserSearch, setPermUserSearch] = useState('');
  const [permDeptSearch, setPermDeptSearch] = useState('');
  const [permSaving, setPermSaving] = useState(false);

  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
        setMenuPos(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuId]);

  React.useEffect(() => {
    const currentLang = i18n.language;
    if (TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(currentLang, 'taskManager', TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);

  const showStates = mode === 'all' || mode === 'states';
  const showRules  = mode === 'all' || mode === 'rules';

  // Load status permissions and creation restriction when in states mode
  useEffect(() => {
    if (showStates && projectId) {
      fetchPerms();
      fetchCreationRestriction();
    }
  }, [showStates, projectId, fetchPerms]);

  const openPermDrawer = (statusId: number) => {
    const existing = permData.permissions.find(p => p.status_id === statusId);
    setPermSelectedUsers(existing?.user_ids ? JSON.parse(existing.user_ids) : []);
    setPermSelectedDepts(existing?.department_ids ? JSON.parse(existing.department_ids) : []);
    setPermUserSearch('');
    setPermDeptSearch('');
    setPermDrawerStatusId(statusId);
  };

  const closePermDrawer = () => { setPermDrawerStatusId(null); };

  const handlePermSave = async () => {
    if (!permDrawerStatusId) return;
    setPermSaving(true);
    try {
      if (permSelectedUsers.length === 0 && permSelectedDepts.length === 0) {
        await deletePermission(permDrawerStatusId);
      } else {
        await savePermission(permDrawerStatusId, permSelectedUsers, permSelectedDepts);
      }
      closePermDrawer();
    } finally {
      setPermSaving(false);
    }
  };

  const permStatus = permDrawerStatusId ? statuses.find(s => s.id === permDrawerStatusId) : null;
  const filteredPermMembers = useMemo(() => {
    const q = permUserSearch.toLowerCase();
    return !q ? members : members.filter(m =>
      (m.full_name || '').toLowerCase().includes(q) || (m.username || '').toLowerCase().includes(q)
    );
  }, [members, permUserSearch]);
  const filteredPermDepts = useMemo(() => {
    const q = permDeptSearch.toLowerCase();
    return !q ? departments : departments.filter(d => getDeptName(d).toLowerCase().includes(q));
  }, [departments, permDeptSearch, getDeptName]);

  const sortedStatuses = useMemo(
    () => [...statuses].sort((a, b) => a.order_index - b.order_index),
    [statuses]
  );

  const selectedStatus = sortedStatuses.find((s) => s.id === editingStatusId) || null;

  const byGroup = useMemo(() => {
    const map: Record<StatusGroup, typeof sortedStatuses> = {
      new: [], in_progress: [], done: [], canceled: [],
    };
    for (const s of sortedStatuses) {
      const g = ((s as any).status_group || 'in_progress') as StatusGroup;
      if (map[g]) map[g].push(s);
    }
    return map;
  }, [sortedStatuses]);

  const hasForm = creatingInGroup !== null || !!selectedStatus;

  const resetForm = () => {
    setStatusName('');
    setStatusIsInitial(false);
  };

  const regenerateColor = () => {
    const used = sortedStatuses
      .filter((s) => !selectedStatus || s.id !== selectedStatus.id)
      .map((s) => s.color);
    setStatusColor(pickUniqueColor(used));
  };

  const startCreate = (group: StatusGroup) => {
    setEditingStatusId(null);
    setCreatingInGroup(group);
    setEditingGroup(group);
    setStatusName('');
    setStatusIsInitial(false);
    const used = sortedStatuses.map((s) => s.color);
    setStatusColor(pickUniqueColor(used));
    setDrawerOpen(true);
  };

  const startEdit = (status: (typeof sortedStatuses)[0]) => {
    setCreatingInGroup(null);
    setEditingStatusId(status.id);
    setStatusName(status.name);
    setStatusColor(status.color);
    setEditingGroup(((status as any).status_group || 'in_progress') as StatusGroup);
    setStatusIsInitial(!!(status as any).is_initial);
    setDrawerOpen(true);
  };

  const cancelForm = () => {
    resetForm();
    setEditingStatusId(null);
    setCreatingInGroup(null);
    setDrawerOpen(false);
  };

  const handleCreate = async () => {
    if (!statusName.trim()) { alert(t('validation.enterStatusName')); return; }
    const success = await createStatus({ name: statusName, color: statusColor, status_group: editingGroup, is_initial: statusIsInitial });
    if (success) { cancelForm(); onStatusChange?.(); }
  };

  const handleUpdate = async () => {
    if (!selectedStatus) return;
    if (!statusName.trim()) { alert(t('validation.enterStatusName')); return; }
    const success = await updateStatus(selectedStatus.id, { name: statusName, color: statusColor, status_group: editingGroup, is_initial: statusIsInitial });
    if (success) { cancelForm(); onStatusChange?.(); }
  };

  if (loading && statuses.length === 0) {
    return <div className="text-center py-8 text-gray-500">{t('workflowEditorLoading')}</div>;
  }

  return (
    <div className="space-y-2">
      {showRules && <WorkflowSettings projectId={projectId} />}

      {showStates && (
        <div className="flex justify-center">
          <div className="w-full max-w-xl space-y-2">

          {/* ── Status edit permissions toggle ── */}
          {statuses.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-white border border-gray-200 rounded-xl">
              <div className="min-w-0 mr-3">
                <p className="text-sm font-semibold text-gray-800">{t('statusPermissionsTitle')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t('statusPermissionsDesc')}</p>
              </div>
              <button
                onClick={() => setToggle(!permData.enabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${permData.enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${permData.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
          )}

          {/* ── Creation restriction toggle ── */}
          {statuses.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-white border border-gray-200 rounded-xl">
              <div className="min-w-0 mr-3">
                <p className="text-sm font-semibold text-gray-800">{t('creationRestrictionTitle')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t('creationRestrictionDesc')}</p>
              </div>
              <button
                onClick={() => toggleCreationRestriction(!creationRestriction)}
                disabled={creationRestrictionLoading}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-60 ${creationRestriction ? 'bg-green-500' : 'bg-gray-200'}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${creationRestriction ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
          )}

          {GROUP_ORDER.map((group) => {
            const gc = GROUP_COLORS[group];
            const groupItems = byGroup[group];

            return (
              <div key={group} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                {/* Group header */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${gc.dot}`} />
                    <span className="text-sm font-semibold text-gray-700">{t(`statusGroup_${group}`)}</span>
                    <span className="text-xs text-gray-400">({groupItems.length})</span>
                  </div>
                  <button
                    onClick={() => startCreate(group)}
                    className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {t('workflowEditorAddStatus')}
                  </button>
                </div>

                {/* Status rows */}
                {groupItems.length > 0 && (
                  <div className="divide-y divide-gray-100">
                    {groupItems.map((status, index) => (
                      <div key={status.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex flex-col gap-0.5">
                            <button onClick={() => { if (index === 0) return; const prev = groupItems[index - 1]; updateStatus(status.id, { order_index: prev.order_index }); updateStatus(prev.id, { order_index: status.order_index }); }} disabled={index === 0} className="text-gray-300 hover:text-gray-500 disabled:opacity-20">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                            </button>
                            <button onClick={() => { if (index === groupItems.length - 1) return; const next = groupItems[index + 1]; updateStatus(status.id, { order_index: next.order_index }); updateStatus(next.id, { order_index: status.order_index }); }} disabled={index === groupItems.length - 1} className="text-gray-300 hover:text-gray-500 disabled:opacity-20">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                          </div>
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
                          <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium text-gray-900">{translateStatus(status)}</span>
                            {status.is_system === true && (
                              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-400 text-xs rounded font-medium">{t('workflowEditorSystem')}</span>
                            )}
                            {creationRestriction && (status as any).is_initial === true && (
                              <span className="px-1.5 py-0.5 bg-green-50 text-green-600 text-xs rounded font-medium border border-green-200" title={t('statusIsInitialDesc')}>
                                {t('statusIsInitial')}
                              </span>
                            )}
                          
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {/* Creation restriction toggle — shown inline for ALL statuses when restriction is ON */}
                          {creationRestriction && (() => {
                            const isInitial = !!(status as any).is_initial;
                            return (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleStatusIsInitial(status.id, !isInitial); }}
                                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors ${
                                  isInitial
                                    ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                                    : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                }`}
                                title={t('statusIsInitialDesc')}
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                {isInitial ? t('statusIsInitial') : t('statusIsInitialOff')}
                              </button>
                            );
                          })()}
                          {/* Permission assignment button — shown when toggle is ON */}
                          {permData.enabled && (() => {
                            const perm = permData.permissions.find(p => p.status_id === status.id);
                            const userCount = perm?.user_ids ? JSON.parse(perm.user_ids).length : 0;
                            const deptCount = perm?.department_ids ? JSON.parse(perm.department_ids).length : 0;
                            const hasRestriction = userCount > 0 || deptCount > 0;
                            return (
                              <button
                                onClick={(e) => { e.stopPropagation(); openPermDrawer(status.id); }}
                                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors ${
                                  hasRestriction
                                    ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                    : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                }`}
                                title={t('statusPermissionsEditFor')}
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {hasRestriction
                                  ? [userCount > 0 && t('statusPermissionsAddedUsers', { count: userCount }), deptCount > 0 && t('statusPermissionsAddedDepts', { count: deptCount })].filter(Boolean).join(' · ')
                                  : t('statusPermissionsNoRestriction')}
                              </button>
                            );
                          })()}
                          <button
                            onClick={(e) => { e.stopPropagation(); if (openMenuId === status.id) { setOpenMenuId(null); setMenuPos(null); return; } const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); setMenuPos({ top: rect.bottom + 4, left: rect.right - 128 }); setOpenMenuId(status.id); }}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {groupItems.length === 0 && (
                  <div className="px-4 py-3 text-xs text-gray-400 italic">{t('workflowEditorNoStatuses')}</div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      )}

      {showRules && statuses.length > 0 && (
        <TransitionsEditor projectId={projectId} statuses={statuses} onSave={() => fetchStatuses()} />
      )}

      {/* Status permissions drawer */}
      {permDrawerStatusId !== null && <div className="fixed inset-0 z-40 bg-black/20" onClick={closePermDrawer} />}
      <div className={`fixed top-0 right-0 h-full bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ${permDrawerStatusId !== null ? 'translate-x-0' : 'translate-x-full'}`} style={{ width: 340 }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{t('statusPermissionsEditFor')}</h3>
            {permStatus && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: permStatus.color }} />
                <span className="text-xs text-gray-500">{translateStatus(permStatus)}</span>
              </div>
            )}
          </div>
          <button onClick={closePermDrawer} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Users */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">👤 {t('statusPermissionsUsers')}</p>
            <input
              type="text"
              value={permUserSearch}
              onChange={e => setPermUserSearch(e.target.value)}
              placeholder={t('transitionsEditorSearch')}
              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md mb-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="rounded-lg border border-gray-200 bg-gray-50/40 p-2 max-h-48 overflow-y-auto space-y-0.5">
              {filteredPermMembers.map(m => (
                <label key={m.user_id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-white cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={permSelectedUsers.includes(m.user_id)}
                    onChange={() => setPermSelectedUsers(prev =>
                      prev.includes(m.user_id) ? prev.filter(id => id !== m.user_id) : [...prev, m.user_id]
                    )}
                    className="w-3.5 h-3.5 rounded text-blue-600"
                  />
                  <Avatar name={m.full_name || m.username} imageUrl={`/avatar_${m.user_id}.png`} size="sm" className="shrink-0" />
                  <span className="text-sm text-gray-800 truncate">{m.full_name || m.username}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Departments */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">🏢 {t('statusPermissionsDepartments')}</p>
            <input
              type="text"
              value={permDeptSearch}
              onChange={e => setPermDeptSearch(e.target.value)}
              placeholder={t('transitionsEditorSearch')}
              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md mb-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="rounded-lg border border-gray-200 bg-gray-50/40 p-2 max-h-48 overflow-y-auto space-y-0.5">
              {departments.length === 0
                ? <p className="text-xs text-gray-400 italic px-2">{t('transitionsEditorNoDepartments')}</p>
                : filteredPermDepts.map(d => (
                  <label key={d.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-white cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={permSelectedDepts.includes(d.id)}
                      onChange={() => setPermSelectedDepts(prev =>
                        prev.includes(d.id) ? prev.filter(id => id !== d.id) : [...prev, d.id]
                      )}
                      className="w-3.5 h-3.5 rounded text-purple-600"
                    />
                    <span className="text-sm text-gray-800">{getDeptName(d)}</span>
                  </label>
                ))
              }
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-gray-100 flex gap-2 justify-end shrink-0">
          <button onClick={closePermDrawer} className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
            {t('cancel')}
          </button>
          <button onClick={handlePermSave} disabled={permSaving}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40 transition-colors">
            {permSaving ? '...' : t('statusPermissionsSave')}
          </button>
        </div>
      </div>

      {/* Backdrop */}
      {drawerOpen && <div className="fixed inset-0 z-40 bg-black/20" onClick={cancelForm} />}

      {/* Status drawer */}
      <div className={`fixed top-0 right-0 h-full bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`} style={{ width: 340 }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {creatingInGroup ? t('workflowEditorCreateStatus') : t('workflowEditorEditStatus')}
            </h3>
          </div>
          <button onClick={cancelForm} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Color + Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">{t('workflowEditorName')} *</label>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full border-2 border-white shadow shrink-0" style={{ backgroundColor: statusColor }} />
              <input
                type="text"
                value={statusName}
                onChange={(e) => setStatusName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { creatingInGroup ? handleCreate() : handleUpdate(); } if (e.key === 'Escape') { cancelForm(); } }}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('workflowEditorName')}
                autoFocus
              />
            </div>
          </div>

          {/* Color palette */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-700">{t('workflowEditorColor')}</label>
              <button onClick={regenerateColor} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {t('workflowEditorRandomColor')}
              </button>
            </div>
            <div className="grid grid-cols-10 gap-1.5">
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  onClick={() => setStatusColor(color)}
                  className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${statusColor.toLowerCase() === color.toLowerCase() ? 'ring-2 ring-offset-1 ring-gray-500 scale-110' : ''}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Group selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">{t('workflowEditorGroup')}</label>
            <div className="grid grid-cols-2 gap-1.5">
              {GROUP_ORDER.map((g) => {
                const gc = GROUP_COLORS[g];
                return (
                  <button
                    key={g}
                    onClick={() => setEditingGroup(g)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                      editingGroup === g ? gc.badge : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${gc.dot}`} />
                    {t(`statusGroup_${g}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Allow task creation toggle — only shown when creation restriction is enabled globally */}
          {creationRestriction && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="min-w-0 mr-3">
                <p className="text-xs font-semibold text-gray-700">{t('statusIsInitial')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t('statusIsInitialDesc')}</p>
              </div>
              <button
                onClick={() => setStatusIsInitial(!statusIsInitial)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${statusIsInitial ? 'bg-green-500' : 'bg-gray-200'}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${statusIsInitial ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100">
          <div className="flex gap-2">
            <button onClick={cancelForm} className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              {t('workflowEditorCancel')}
            </button>
            <button
              onClick={creatingInGroup ? handleCreate : handleUpdate}
              disabled={!statusName.trim()}
              className="flex-1 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {creatingInGroup ? t('workflowEditorCreate') : t('workflowEditorSave')}
            </button>
          </div>
        </div>
      </div>

      {/* Kebab menu */}
      {openMenuId !== null && menuPos && (
        <div ref={menuRef} style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }} className="w-32 bg-white border border-gray-200 rounded-lg shadow-lg py-0.5">
          {(() => {
            const s = sortedStatuses.find(x => x.id === openMenuId);
            const isSystem = s?.is_system === true;
            return (
              <>
                <button disabled={isSystem} onClick={(e) => { e.stopPropagation(); const st = sortedStatuses.find(x => x.id === openMenuId); setOpenMenuId(null); setMenuPos(null); if (st) startEdit(st); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  {t('workflowEditorEdit')}
                </button>
                <button disabled={isSystem} onClick={async (e) => { e.stopPropagation(); const id = openMenuId; const st = sortedStatuses.find(x => x.id === id); setOpenMenuId(null); setMenuPos(null); if (!isSystem && confirm(t('validation.deleteStatusConfirm', { statusName: st ? translateStatus(st) : '' }))) { const success = await deleteStatus(id); if (success) { if (editingStatusId === id) cancelForm(); onStatusChange?.(); } } }} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  {t('workflowEditorDelete')}
                </button>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};

