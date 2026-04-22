import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectMembers } from '../hooks/useProjectMembers';
import { useDepartments } from '../hooks/useDepartments';
import { useTransitions } from '../hooks/useTransitions';
import { useStatusTranslation } from '../hooks/useStatusTranslation';
import { useCustomFields } from '../hooks/useCustomFields';
import { useErrorTranslation } from '../hooks/useErrorTranslation';
import { Avatar } from './ui/Avatar';
import { ToastContainer } from './Toast';
import TaskManagerTranslation from '../TaskManagerTranslation.json';

interface TransitionsEditorProps {
  projectId: number;
  statuses: any[];
  onSave: () => void;
}

type PermType = 'any' | 'roles' | 'departments' | 'users';

interface FormState {
  fromStatusId: number;
  toStatusId: number | null;
  isBidirectional: boolean;
  permissionType: PermType;
  selectedRoles: string[];
  selectedDepartmentIds: number[];
  selectedUsers: number[];
  userSearchQuery: string;
  requiresAttachment: boolean;
  requiresApprovals: boolean;
  approvalMode: 'any_member' | 'count' | 'all';
  approverSource: 'users' | 'departments';
  requiredApprovalsCount: number;
  selectedApprovers: number[];
  approverDepartmentIds: number[];
  approverSearchQuery: string;
  approverDeptSearchQuery: string;
  autoTransition: boolean;
  requiresFields: boolean;
  selectedRequiredFields: string[];
  fieldSearchQuery: string;
}

const EMPTY_FORM = (fromStatusId: number): FormState => ({
  fromStatusId,
  toStatusId: null,
  isBidirectional: false,
  permissionType: 'any',
  selectedRoles: ['member', 'admin', 'owner'],
  selectedDepartmentIds: [],
  selectedUsers: [],
  userSearchQuery: '',
  requiresAttachment: false,
  requiresApprovals: false,
  approvalMode: 'count',
  approverSource: 'users',
  requiredApprovalsCount: 1,
  selectedApprovers: [],
  approverDepartmentIds: [],
  approverSearchQuery: '',
  approverDeptSearchQuery: '',
  autoTransition: false,
  requiresFields: false,
  selectedRequiredFields: [],
  fieldSearchQuery: '',
});

// Step indicator
const StepDots: React.FC<{ current: number; total: number }> = ({ current, total }) => (
  <div className="flex items-center gap-1.5">
    {Array.from({ length: total }, (_, i) => (
      <div key={i} className={`rounded-full transition-all ${i + 1 === current ? 'w-5 h-2 bg-blue-600' : i + 1 < current ? 'w-2 h-2 bg-blue-300' : 'w-2 h-2 bg-gray-200'}`} />
    ))}
  </div>
);

export const TransitionsEditor: React.FC<TransitionsEditorProps> = ({ projectId, statuses, onSave }) => {
  const { t, i18n } = useTranslation('taskManager');
  const { translateError } = useErrorTranslation();
  const { translateStatus } = useStatusTranslation();
  const { members } = useProjectMembers(projectId);
  const { departments, getDeptName } = useDepartments();
  const { transitions, deleteTransition, fetchTransitions } = useTransitions(projectId);
  const { fields: customFields } = useCustomFields(projectId);

  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [editingTransitionId, setEditingTransitionId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'error' | 'success' | 'warning' }>>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  const showToast = (message: string, type: 'error' | 'success' | 'warning' = 'warning') => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  };
  const removeToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

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
    const lang = i18n.language;
    if (TaskManagerTranslation[lang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(lang, 'taskManager', TaskManagerTranslation[lang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);

  const roles = [
    { value: 'viewer', label: t('transitionsEditorViewer') },
    { value: 'member', label: t('transitionsEditorMember') },
    { value: 'admin', label: t('transitionsEditorAdmin') },
    { value: 'owner', label: t('transitionsEditorOwner') },
  ];

  const transitionsByStatus = useMemo(() => {
    const map: Record<number, any[]> = {};
    for (const s of statuses) map[s.id] = [];
    for (const tr of transitions) {
      if (map[tr.from_status_id]) map[tr.from_status_id].push(tr);
    }
    return map;
  }, [transitions, statuses]);

  const sortedStatuses = useMemo(
    () => [...statuses].sort((a, b) => a.order_index - b.order_index),
    [statuses]
  );

  const toggleGroup = (statusId: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(statusId)) next.delete(statusId); else next.add(statusId);
      return next;
    });
  };

  const openDrawer = (f: FormState, transitionId: number | null = null, startStep = 1) => {
    setForm(f);
    setEditingTransitionId(transitionId);
    setStep(startStep);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setForm(null);
    setEditingTransitionId(null);
    setStep(1);
  };

  const setF = (patch: Partial<FormState>) => setForm((prev) => prev ? { ...prev, ...patch } : prev);

  const startCreate = (statusId: number) => {
    setExpandedGroups((prev) => new Set([...prev, statusId]));
    openDrawer(EMPTY_FORM(statusId), null, 1);
  };

  const startEdit = (transition: any) => {
    const f: FormState = {
      fromStatusId: transition.from_status_id,
      toStatusId: transition.to_status_id,
      isBidirectional: transition.is_bidirectional || false,
      permissionType: transition.permission_type || 'any',
      selectedRoles: [],
      selectedDepartmentIds: [],
      selectedUsers: [],
      userSearchQuery: '',
      requiresAttachment: transition.requires_attachment || false,
      requiresApprovals: transition.requires_approvals || false,
      approvalMode: transition.approval_mode || 'count',
      approverSource: transition.approver_departments ? 'departments' : 'users',
      requiredApprovalsCount: transition.required_approvals_count || 1,
      selectedApprovers: [],
      approverDepartmentIds: [],
      approverSearchQuery: '',
      approverDeptSearchQuery: '',
      autoTransition: transition.auto_transition || false,
    };
    if (transition.permission_type === 'roles' && transition.allowed_roles) {
      try { f.selectedRoles = JSON.parse(transition.allowed_roles); } catch { f.selectedRoles = []; }
    }
    if (transition.permission_type === 'departments' && transition.allowed_users) {
      try { f.selectedDepartmentIds = JSON.parse(transition.allowed_users); } catch { f.selectedDepartmentIds = []; }
    }
    if (transition.permission_type === 'users' && transition.allowed_users) {
      try { f.selectedUsers = JSON.parse(transition.allowed_users); } catch { f.selectedUsers = []; }
    }
    if (transition.required_approvers) {
      try { f.selectedApprovers = JSON.parse(transition.required_approvers); } catch { f.selectedApprovers = []; }
    }
    if (transition.approver_departments) {
      try { f.approverDepartmentIds = JSON.parse(transition.approver_departments); } catch { f.approverDepartmentIds = []; }
    }
    if (transition.required_fields) {
      try {
        f.selectedRequiredFields = JSON.parse(transition.required_fields);
        f.requiresFields = f.selectedRequiredFields.length > 0;
      } catch { f.selectedRequiredFields = []; }
    }
    openDrawer(f, transition.id, 1);
  };

  const handleSave = async () => {
    if (!form || !form.toStatusId) return;

    const allowedRoles = form.permissionType === 'roles' ? JSON.stringify(form.selectedRoles) : null;
    const allowedUsers = form.permissionType === 'users'
      ? JSON.stringify(form.selectedUsers)
      : form.permissionType === 'departments'
        ? JSON.stringify(form.selectedDepartmentIds)
        : null;

    const payload = {
      from_status_id: form.fromStatusId,
      to_status_id: form.toStatusId,
      permission_type: form.permissionType,
      allowed_roles: allowedRoles,
      allowed_users: allowedUsers,
      is_bidirectional: form.isBidirectional,
      requires_attachment: form.requiresAttachment,
      requires_approvals: form.requiresApprovals,
      approval_mode: form.requiresApprovals ? form.approvalMode : 'count',
      required_approvals_count: form.requiresApprovals && form.approvalMode === 'count' ? form.requiredApprovalsCount : 0,
      required_approvers: form.requiresApprovals && form.approverSource === 'users' && form.selectedApprovers.length > 0
        ? JSON.stringify(form.selectedApprovers) : JSON.stringify([]),
      approver_departments: form.requiresApprovals && form.approverSource === 'departments' && form.approverDepartmentIds.length > 0
        ? JSON.stringify(form.approverDepartmentIds) : JSON.stringify([]),
      auto_transition: form.autoTransition,
      required_fields: form.requiresFields && form.selectedRequiredFields.length > 0
        ? JSON.stringify(form.selectedRequiredFields) : null,
    };

    try {
      const token = localStorage.getItem('authToken');
      const isEditing = editingTransitionId !== null;
      const url = isEditing
        ? `/api/task-manager/workflow/transitions/${editingTransitionId}`
        : `/api/task-manager/workflow/transitions`;
      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(isEditing ? payload : { ...payload, project_id: projectId }),
      });
      const data = await response.json();
      if (data.success) {
        closeDrawer();
        fetchTransitions();
        onSave();
      } else {
        const errorMsg = data.error || 'saveTransitionError';
        showToast(translateError(errorMsg), 'warning');
      }
    } catch {
      showToast(t('transitionsEditorSaveTransitionError'), 'warning');
    }
  };

  const handleDeleteTransition = async (transitionId: number, closeAfterDelete = false) => {
    if (!confirm(t('validation.deleteTransitionConfirm'))) return;
    const ok = await deleteTransition(transitionId);
    if (ok) {
      if (closeAfterDelete) closeDrawer();
      return;
    }
    showToast(t('transitionsEditorDeleteError'), 'error');
  };

  const canProceedStep1 = form?.toStatusId != null;
  const canProceedStep2 = !form ? false :
    form.permissionType === 'any' ? true :
    form.permissionType === 'roles' ? form.selectedRoles.length > 0 :
    form.permissionType === 'departments' ? form.selectedDepartmentIds.length > 0 :
    form.selectedUsers.length > 0;

  const permissionLabel = (transition: any) => {
    const pt = transition.permission_type;
    if (pt === 'any') return t('transitionsEditorAnyParticipant');
    if (pt === 'roles') {
      let r: string[] = [];
      try {
        r = transition.allowed_roles ? JSON.parse(transition.allowed_roles) : [];
      } catch {
        r = [];
      }
      return r.map((v: string) => ({ owner: t('transitionsEditorOwner'), admin: t('transitionsEditorAdmin'), member: t('transitionsEditorMember'), viewer: t('transitionsEditorViewer') }[v] || v)).join(', ');
    }
    if (pt === 'departments') {
      let ids: number[] = [];
      try {
        ids = transition.allowed_users ? JSON.parse(transition.allowed_users) : [];
      } catch {
        ids = [];
      }
      const names = ids.map((id) => { const d = departments.find((d) => d.id === id); return d ? getDeptName(d) : `#${id}`; });
      return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
    }
    let ids: number[] = [];
    try {
      ids = transition.allowed_users ? JSON.parse(transition.allowed_users) : [];
    } catch {
      ids = [];
    }
    const names = ids.map((id: number) => { const m = members.find((m) => m.user_id === id); return m?.full_name || m?.username || `#${id}`; });
    return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
  };

  const fromStatus = form ? sortedStatuses.find((s) => s.id === form.fromStatusId) : null;
  const toStatus = form?.toStatusId ? sortedStatuses.find((s) => s.id === form.toStatusId) : null;

  const filteredMembers = useMemo(() => {
    if (!form) return members;
    const q = form.userSearchQuery.toLowerCase();
    return !q ? members : members.filter((m) =>
      (m.full_name || '').toLowerCase().includes(q) || (m.username || '').toLowerCase().includes(q)
    );
  }, [members, form?.userSearchQuery]);

  const filteredApprovers = useMemo(() => {
    if (!form) return members;
    const q = form.approverSearchQuery.toLowerCase();
    return !q ? members : members.filter((m) =>
      (m.full_name || '').toLowerCase().includes(q) || (m.username || '').toLowerCase().includes(q)
    );
  }, [members, form?.approverSearchQuery]);

  const TOTAL_STEPS = 3 + (form?.requiresApprovals ? 1 : 0) + (form?.requiresFields ? 1 : 0);

  // Step numbers for approval/fields steps
  const APPROVAL_STEP = form?.requiresApprovals ? 4 : null;
  const FIELDS_STEP = form?.requiresFields ? (form?.requiresApprovals ? 5 : 4) : null;

  // Нормализуем шаги при динамическом изменении опций мастера,
  // чтобы не оставаться на несуществующем шаге.
  useEffect(() => {
    if (!drawerOpen || !form) return;
    const maxStep = FIELDS_STEP ?? APPROVAL_STEP ?? 3;
    if (step > maxStep) setStep(maxStep);
  }, [drawerOpen, form, step, APPROVAL_STEP, FIELDS_STEP]);

  // All available fields for required-fields selector
  const STANDARD_FIELDS = useMemo(() => [
    { key: 'description', label: t('transitionsFieldDescription') },
    { key: 'assignee_id', label: t('transitionsFieldAssignee') },
    { key: 'due_date',    label: t('transitionsFieldDueDate') },
    { key: 'priority',   label: t('transitionsFieldPriority') },
  ], [t]);

  const allFields = useMemo(() => [
    ...STANDARD_FIELDS,
    ...(customFields || [])
      .filter(f => f.is_active)
      .map(f => ({ key: `custom_${f.id}`, label: f.field_name })),
  ], [STANDARD_FIELDS, customFields]);

  const filteredAllFields = useMemo(() => {
    if (!form) return allFields;
    const q = form.fieldSearchQuery.toLowerCase();
    return !q ? allFields : allFields.filter(f => f.label.toLowerCase().includes(q));
  }, [allFields, form?.fieldSearchQuery]);

  const inner = (
    <>
      <div className="mt-2 pt-2 border-t border-gray-200">
        <div className="flex justify-center">
          <div className="w-full max-w-xl space-y-2">
            <h4 className="font-semibold text-gray-800 text-sm mb-3">{t('transitionsEditorTitle')}</h4>

            {sortedStatuses.map((status) => {
              const statusTransitions = transitionsByStatus[status.id] || [];
              const isExpanded = expandedGroups.has(status.id);

              return (
                <div key={status.id} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100 cursor-pointer select-none" onClick={() => toggleGroup(status.id)}>
                    <div className="flex items-center gap-2">
                      <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
                      <span className="text-sm font-semibold text-gray-700">{translateStatus(status)}</span>
                      {statusTransitions.length > 0 && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-md">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          <span className="text-xs font-semibold leading-none">{statusTransitions.length}</span>
                        </div>
                      )}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); startCreate(status.id); }}
                      className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {t('transitionsEditorAddTransition')}
                    </button>
                  </div>

                  {isExpanded && (
                    <>
                      {statusTransitions.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-gray-400 italic">{t('transitionsEditorNoTransitions')}</div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          <div className="grid grid-cols-[1fr_1.2fr_1.4fr_auto] gap-2 px-4 py-1.5 bg-gray-50 border-b border-gray-100">
                            <span className="text-xs text-gray-400 font-medium">{t('transitionsEditorVia')}</span>
                            <span className="text-xs text-gray-400 font-medium">{t('transitionsEditorToStatus')}</span>
                            <span className="text-xs text-gray-400 font-medium">{t('transitionsEditorBy')}</span>
                            <span />
                          </div>
                          {statusTransitions.map((tr) => (
                            <div key={tr.id} className="grid grid-cols-[1fr_1.2fr_1.4fr_auto] gap-2 items-center px-4 py-2.5 hover:bg-gray-50 transition-colors">
                              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                {tr.is_bidirectional ? (
                                  <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                  </svg>
                                ) : (
                                  <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                  </svg>
                                )}
                                <span>{t('transitionsEditorTransitionLabel')}</span>
                              </div>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statuses.find((s) => s.id === tr.to_status_id)?.color || '#aaa' }} />
                                <span className="text-xs font-medium text-gray-800 truncate">
                                  {translateStatus(statuses.find((s) => s.id === tr.to_status_id) || { name: tr.to_status_name, is_system: false })}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="text-xs text-gray-600 truncate">{permissionLabel(tr)}</span>
                                {tr.requires_attachment && <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded shrink-0">{t('transitionsEditorFile')}</span>}
                                {tr.requires_approvals && <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded shrink-0">✓</span>}
                              </div>
                              <div className="relative flex items-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (openMenuId === tr.id) {
                                      setOpenMenuId(null);
                                      setMenuPos(null);
                                    } else {
                                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                      setMenuPos({ top: rect.bottom + 4, left: rect.right - 128 });
                                      setOpenMenuId(tr.id);
                                    }
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {drawerOpen && <div className="fixed inset-0 z-40 bg-black/20" onClick={closeDrawer} />}

      {/* Drawer */}
      <div className={`fixed top-0 right-0 h-full w-84 bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`} style={{ width: 340 }}>

        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <StepDots current={step} total={TOTAL_STEPS} />
            <div className="text-xs text-gray-400">
              {t('transitionsWizardStep')} {step}/{TOTAL_STEPS}
            </div>
          </div>
          <button onClick={closeDrawer} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* From-status pill */}
        {fromStatus && (
          <div className="px-5 pt-3 pb-0 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: fromStatus.color }} />
            <span className="text-xs font-medium text-gray-600">{translateStatus(fromStatus)}</span>
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            {toStatus ? (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: toStatus.color }} />
                <span className="text-xs font-medium text-gray-600">{translateStatus(toStatus)}</span>
              </div>
            ) : (
              <span className="text-xs text-gray-300">...</span>
            )}
          </div>
        )}

        {/* Step body */}
        {form && (
          <div className="flex-1 overflow-y-auto px-5 py-4">

            {/* ─── STEP 1: Destination ─── */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">{t('transitionsWizardStep1Title')}</h3>
                  <p className="text-xs text-gray-400">{t('transitionsWizardStep1Desc')}</p>
                </div>

                {/* Custom status selector */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">{t('transitionsEditorToStatus')} *</label>
                  <div className="space-y-1.5">
                    {sortedStatuses.filter((s) => s.id !== form.fromStatusId).map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setF({ toStatusId: s.id })}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                          form.toStatusId === s.id
                            ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="text-sm font-medium text-gray-800">{translateStatus(s)}</span>
                        {form.toStatusId === s.id && (
                          <svg className="w-4 h-4 text-blue-600 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bidirectional */}
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.isBidirectional}
                    onChange={(e) => setF({ isBidirectional: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-800">{t('transitionsEditorBidirectional')}</div>
                    <div className="text-xs text-gray-400">{t('transitionsEditorBidirectionalDesc')}</div>
                  </div>
                </label>
              </div>
            )}

            {/* ─── STEP 2: Who can transfer ─── */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">{t('transitionsWizardStep2Title')}</h3>
                </div>

                {/* Permission type selector — compact chips */}
                <div className="space-y-1.5">
                  {([
                    { value: 'any', icon: '🌐', label: t('transitionsEditorAnyMember') },
                    { value: 'roles', icon: '🎭', label: t('transitionsEditorByRoles') },
                    { value: 'departments', icon: '🏢', label: t('transitionsEditorByDepartments') },
                    { value: 'users', icon: '👤', label: t('transitionsEditorSpecificUsers') },
                  ] as const).map(({ value, icon, label }) => (
                    <button
                      key={value}
                      onClick={() => setF({ permissionType: value as PermType })}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all ${
                        form.permissionType === value
                          ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-base">{icon}</span>
                      <span className="text-sm font-medium text-gray-800">{label}</span>
                      {form.permissionType === value && (
                        <svg className="w-4 h-4 text-blue-600 ml-auto shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>

                {/* Roles */}
                {form.permissionType === 'roles' && (
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-2 space-y-0.5">
                    {roles.map((role) => (
                      <label key={role.value} className="flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-white cursor-pointer transition-colors">
                        <input type="checkbox" checked={form.selectedRoles.includes(role.value)}
                          onChange={() => setF({ selectedRoles: form.selectedRoles.includes(role.value) ? form.selectedRoles.filter((r) => r !== role.value) : [...form.selectedRoles, role.value] })}
                          className="w-4 h-4 text-blue-600 rounded" />
                        <span className="text-sm text-gray-700">{role.label}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Departments */}
                {form.permissionType === 'departments' && (
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-2">
                    <input
                      type="text"
                      value={form.userSearchQuery}
                      onChange={(e) => setF({ userSearchQuery: e.target.value })}
                      placeholder={t('transitionsEditorSearch')}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md mb-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {departments.length === 0 ? (
                      <p className="text-xs text-gray-400 italic px-2">{t('transitionsEditorNoDepartments')}</p>
                    ) : (
                      <div className="space-y-0.5">
                        {departments
                          .filter((d) => !form.userSearchQuery || getDeptName(d).toLowerCase().includes(form.userSearchQuery.toLowerCase()))
                          .map((dept) => (
                            <label key={dept.id} className="flex items-center gap-2.5 px-3 py-1.5 rounded-md hover:bg-white cursor-pointer transition-colors">
                              <input type="checkbox" checked={form.selectedDepartmentIds.includes(dept.id)}
                                onChange={() => setF({
                                  selectedDepartmentIds: form.selectedDepartmentIds.includes(dept.id)
                                    ? form.selectedDepartmentIds.filter((id) => id !== dept.id)
                                    : [...form.selectedDepartmentIds, dept.id]
                                })}
                                className="w-4 h-4 text-blue-600 rounded" />
                              <span className="text-sm text-gray-800">{getDeptName(dept)}</span>
                            </label>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Specific users with avatars */}
                {form.permissionType === 'users' && (
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-2">
                    <input type="text" value={form.userSearchQuery}
                      onChange={(e) => setF({ userSearchQuery: e.target.value })}
                      placeholder={t('transitionsEditorSearch')}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md mb-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    <div className="space-y-0.5">
                      {filteredMembers.map((m) => (
                        <label key={m.user_id} className="flex items-center gap-2.5 px-3 py-1.5 rounded-md hover:bg-white cursor-pointer transition-colors">
                          <input type="checkbox" checked={form.selectedUsers.includes(m.user_id)}
                            onChange={() => setF({ selectedUsers: form.selectedUsers.includes(m.user_id) ? form.selectedUsers.filter((id) => id !== m.user_id) : [...form.selectedUsers, m.user_id] })}
                            className="w-4 h-4 text-blue-600 rounded" />
                          <Avatar name={m.full_name || m.username} imageUrl={`/avatar_${m.user_id}.png`} size="sm" className="shrink-0" />
                          <span className="text-sm font-medium text-gray-800 truncate">{m.full_name || m.username}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── STEP 3: Special options ─── */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">{t('transitionsWizardStep3Title')}</h3>
                  <p className="text-xs text-gray-400">{t('transitionsWizardStep3Desc')}</p>
                </div>

                {/* Options */}
                <div className="space-y-2">
                  {/* Requires attachment */}
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                    <input type="checkbox" checked={form.requiresAttachment}
                      onChange={(e) => setF({ requiresAttachment: e.target.checked })}
                      className="w-4 h-4 mt-0.5 text-orange-500 rounded" />
                    <div>
                      <div className="text-sm font-medium text-gray-800">📎 {t('transitionsEditorRequiresAttachment')}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{t('transitionsEditorRequiresAttachmentDesc')}</div>
                    </div>
                  </label>

                  {/* Auto-transition */}
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                    <input type="checkbox" checked={form.autoTransition}
                      onChange={(e) => setF({ autoTransition: e.target.checked })}
                      className="w-4 h-4 mt-0.5 text-indigo-600 rounded" />
                    <div>
                      <div className="text-sm font-medium text-gray-800">⚡ {t('transitionsEditorAutoTransition')}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{t('transitionsEditorAutoTransitionDesc')}</div>
                    </div>
                  </label>

                  {/* Requires approvals */}
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                    <input type="checkbox" checked={form.requiresApprovals}
                      onChange={(e) => setF({ requiresApprovals: e.target.checked })}
                      className="w-4 h-4 mt-0.5 text-purple-600 rounded" />
                    <div>
                      <div className="text-sm font-medium text-gray-800">✅ {t('transitionsEditorRequiresApprovals')}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{t('transitionsEditorRequiresApprovalsDesc')}</div>
                    </div>
                  </label>

                  {/* Requires fields */}
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                    <input type="checkbox" checked={form.requiresFields}
                      onChange={(e) => setF({ requiresFields: e.target.checked })}
                      className="w-4 h-4 mt-0.5 text-green-600 rounded" />
                    <div>
                      <div className="text-sm font-medium text-gray-800">📋 {t('transitionsEditorRequiresFields')}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{t('transitionsEditorRequiresFieldsDesc')}</div>
                    </div>
                  </label>
                </div>

                {/* Hints */}
                {(form.requiresApprovals || form.requiresFields) && (
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg space-y-1">
                    {form.requiresApprovals && (
                      <p className="text-xs text-blue-700 font-medium flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        {t('transitionsWizardStep4Hint')}
                      </p>
                    )}
                    {form.requiresFields && (
                      <p className="text-xs text-green-700 font-medium flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        {t('transitionsWizardFieldsHint')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ─── STEP 4: Approval settings ─── */}
            {step === 4 && form.requiresApprovals && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">{t('transitionsWizardStep4Title')}</h3>
                  <p className="text-xs text-gray-400">{t('transitionsWizardStep4Desc')}</p>
                </div>

                {/* Approval mode */}
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1.5">{t('transitionsEditorApprovalMode')}</p>
                  <div className="space-y-1.5">
                    {([
                      { value: 'any_member', label: t('transitionsEditorModeAny') },
                      { value: 'count',      label: t('transitionsEditorModeCount') },
                      { value: 'all',        label: t('transitionsEditorModeAll') },
                    ] as const).map(({ value, label }) => (
                      <label key={value} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                        form.approvalMode === value
                          ? 'border-purple-400 bg-purple-50 ring-1 ring-purple-400'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}>
                        <input type="radio" name="approvalMode" value={value}
                          checked={form.approvalMode === value}
                          onChange={() => setF({ approvalMode: value })}
                          className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium text-gray-800">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Count input */}
                {form.approvalMode === 'count' && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700">
                        {form.approverSource === 'departments'
                          ? t('transitionsEditorRequiredDepts')
                          : t('transitionsEditorRequiredApprovals')}:
                      </span>
                      <input type="number" min="1"
                        max={form.approverSource === 'departments' ? form.approverDepartmentIds.length || undefined : undefined}
                        value={form.requiredApprovalsCount}
                        onChange={(e) => setF({ requiredApprovalsCount: parseInt(e.target.value) || 1 })}
                        className="w-20 px-2 py-1.5 text-sm border border-gray-200 rounded-lg" />
                      {form.approverSource === 'departments' && form.approverDepartmentIds.length > 0 && (
                        <span className="text-xs text-gray-400">/ {form.approverDepartmentIds.length}</span>
                      )}
                    </div>
                    {form.approverSource === 'departments' && (
                      <p className="text-xs text-amber-600 bg-amber-50 rounded-md px-2.5 py-1.5">
                        {t('transitionsEditorDeptCountHint')}
                      </p>
                    )}
                  </div>
                )}

                {/* Approver pool */}
                {form.approvalMode !== 'any_member' && (
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-2">{t('transitionsEditorWhoShouldApprove')}</p>
                    <div className="flex gap-1.5 mb-3">
                      {(['users', 'departments'] as const).map((src) => (
                        <button key={src} onClick={() => setF({ approverSource: src })}
                          className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                            form.approverSource === src
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                          }`}>
                          {src === 'users' ? `👤 ${t('transitionsEditorSpecificUsers')}` : `🏢 ${t('transitionsEditorByDepartments')}`}
                        </button>
                      ))}
                    </div>

                    {form.approverSource === 'users' && (
                      <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-2">
                        <input type="text" value={form.approverSearchQuery}
                          onChange={(e) => setF({ approverSearchQuery: e.target.value })}
                          placeholder={t('transitionsEditorSearch')}
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md mb-2 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
                        <div className="space-y-0.5">
                          {filteredApprovers.map((m) => (
                            <label key={m.user_id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white cursor-pointer">
                              <input type="checkbox" checked={form.selectedApprovers.includes(m.user_id)}
                                onChange={() => setF({ selectedApprovers: form.selectedApprovers.includes(m.user_id) ? form.selectedApprovers.filter((id) => id !== m.user_id) : [...form.selectedApprovers, m.user_id] })}
                                className="w-3.5 h-3.5 rounded text-purple-600" />
                              <Avatar name={m.full_name || m.username} imageUrl={`/avatar_${m.user_id}.png`} size="sm" className="shrink-0" />
                              <span className="text-sm text-gray-800">{m.full_name || m.username}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {form.approverSource === 'departments' && (
                      <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-2">
                        <input type="text" value={form.approverDeptSearchQuery}
                          onChange={(e) => setF({ approverDeptSearchQuery: e.target.value })}
                          placeholder={t('transitionsEditorSearch')}
                          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md mb-2 bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
                        {departments.length === 0 ? (
                          <p className="text-xs text-gray-400 italic px-2">{t('transitionsEditorNoDepartments')}</p>
                        ) : (
                          <div className="space-y-0.5">
                            {departments
                              .filter((d) => !form.approverDeptSearchQuery || getDeptName(d).toLowerCase().includes(form.approverDeptSearchQuery.toLowerCase()))
                              .map((dept) => (
                                <label key={dept.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white cursor-pointer">
                                  <input type="checkbox" checked={form.approverDepartmentIds.includes(dept.id)}
                                    onChange={() => setF({ approverDepartmentIds: form.approverDepartmentIds.includes(dept.id) ? form.approverDepartmentIds.filter((id) => id !== dept.id) : [...form.approverDepartmentIds, dept.id] })}
                                    className="w-3.5 h-3.5 rounded text-purple-600" />
                                  <span className="text-sm text-gray-800">{getDeptName(dept)}</span>
                                </label>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ─── STEP fields: Required fields ─── */}
            {FIELDS_STEP !== null && step === FIELDS_STEP && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">{t('transitionsWizardFieldsTitle')}</h3>
                  <p className="text-xs text-gray-400">{t('transitionsWizardFieldsDesc')}</p>
                </div>

                <input
                  type="text"
                  value={form.fieldSearchQuery}
                  onChange={(e) => setF({ fieldSearchQuery: e.target.value })}
                  placeholder={t('transitionsEditorSearch')}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />

                <div className="rounded-lg border border-green-100 bg-green-50/30 p-2 space-y-0.5 max-h-80 overflow-y-auto">
                  {filteredAllFields.length === 0 ? (
                    <p className="text-xs text-gray-400 italic px-2 py-2">{t('transitionsFieldsNoFields')}</p>
                  ) : (
                    filteredAllFields.map((field) => (
                      <label key={field.key} className="flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-white cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={form.selectedRequiredFields.includes(field.key)}
                          onChange={() => setF({
                            selectedRequiredFields: form.selectedRequiredFields.includes(field.key)
                              ? form.selectedRequiredFields.filter(k => k !== field.key)
                              : [...form.selectedRequiredFields, field.key],
                          })}
                          className="w-4 h-4 text-green-600 rounded"
                        />
                        <span className="text-sm text-gray-800">{field.label}</span>
                        {field.key.startsWith('custom_') && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded ml-auto shrink-0">
                            {t('transitionsFieldCustom')}
                          </span>
                        )}
                      </label>
                    ))
                  )}
                </div>

                {form.selectedRequiredFields.length > 0 && (
                  <p className="text-xs text-green-700 bg-green-50 rounded-md px-2.5 py-1.5">
                    {t('transitionsFieldsSelected', { count: form.selectedRequiredFields.length })}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Drawer footer */}
        <div className="px-5 py-4 border-t border-gray-100">
          {step === 1 && (
            <div className="flex gap-2">
              <button onClick={closeDrawer} className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                {t('transitionsEditorCancel')}
              </button>
              <button onClick={() => setStep(2)} disabled={!canProceedStep1}
                className="flex-1 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5">
                {t('transitionsWizardNext')}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
          {step === 2 && (
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {t('transitionsWizardBack')}
              </button>
              <button onClick={() => setStep(3)} disabled={!canProceedStep2}
                className="flex-1 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5">
                {t('transitionsWizardNext')}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
          {step === 3 && (
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {t('transitionsWizardBack')}
              </button>
              {(form?.requiresApprovals || form?.requiresFields) ? (
                <button onClick={() => setStep(form?.requiresApprovals ? 4 : FIELDS_STEP!)}
                  className="flex-1 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5">
                  {t('transitionsWizardNext')}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : (
                <>
                  <button onClick={handleSave}
                    className="flex-1 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    {editingTransitionId ? t('transitionsEditorSaveChanges') : t('transitionsEditorSaveTransition')}
                  </button>
                  {editingTransitionId && (
                    <button onClick={async () => { await handleDeleteTransition(editingTransitionId, true); }}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </>
              )}
            </div>
          )}
          {/* Step 4: approvals config */}
          {step === 4 && form?.requiresApprovals && (
            <div className="flex gap-2">
              <button onClick={() => setStep(3)} className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {t('transitionsWizardBack')}
              </button>
              {form?.requiresFields ? (
                <button onClick={() => setStep(FIELDS_STEP!)}
                  className="flex-1 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5">
                  {t('transitionsWizardNext')}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : (
                <>
                  <button onClick={handleSave}
                    className="flex-1 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    {editingTransitionId ? t('transitionsEditorSaveChanges') : t('transitionsEditorSaveTransition')}
                  </button>
                  {editingTransitionId && (
                    <button onClick={async () => { await handleDeleteTransition(editingTransitionId, true); }}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </>
              )}
            </div>
          )}
          {/* Step 4 (no approvals) or Step 5: required fields */}
          {FIELDS_STEP !== null && step === FIELDS_STEP && (
            <div className="flex gap-2">
              <button onClick={() => setStep(form?.requiresApprovals ? 4 : 3)} className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {t('transitionsWizardBack')}
              </button>
              <button onClick={handleSave}
                className="flex-1 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                {editingTransitionId ? t('transitionsEditorSaveChanges') : t('transitionsEditorSaveTransition')}
              </button>
              {editingTransitionId && (
                <button onClick={async () => { await handleDeleteTransition(editingTransitionId, true); }}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {inner}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {openMenuId !== null && menuPos && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
          className="w-32 bg-white border border-gray-200 rounded-lg shadow-lg py-0.5"
        >
          <button
            onClick={(e) => { e.stopPropagation(); const tr = transitions.find(t => t.id === openMenuId); setOpenMenuId(null); setMenuPos(null); if (tr) startEdit(tr); }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            {t('transitionsEditorEdit')}
          </button>
          <button
            onClick={async (e) => { e.stopPropagation(); const id = openMenuId; setOpenMenuId(null); setMenuPos(null); await handleDeleteTransition(id, false); }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {t('transitionsEditorDelete')}
          </button>
        </div>
      )}
    </>
  );
};
