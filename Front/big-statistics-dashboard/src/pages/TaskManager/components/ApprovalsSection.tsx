import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from './ui/Avatar';
import { format } from 'date-fns';
import { enUS, ru, zhCN } from 'date-fns/locale';
import { useAuth } from '../../../context/AuthContext';
import { useErrorTranslation } from '../hooks/useErrorTranslation';
import { ToastContainer } from './Toast';
import TaskManagerTranslation from '../TaskManagerTranslation.json';
import { fetchJsonGetDedup, invalidateGetDedup } from '../../../utils/fetchDedup';

interface ApprovalsSectionProps {
  taskId: number;
  currentUserId: number;
  projectId: number;
  statusId: number;
  onAutoTransition?: () => void;
}

const API_BASE = '';

export const ApprovalsSection: React.FC<ApprovalsSectionProps> = ({
  taskId, currentUserId, projectId, statusId, onAutoTransition,
}) => {
  const { t, i18n } = useTranslation('taskManager');
  const { user } = useAuth();
  const { translateError } = useErrorTranslation();
  useEffect(() => {
    const lang = i18n.language;
    if (TaskManagerTranslation[lang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(lang, 'taskManager', TaskManagerTranslation[lang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);

  const [approvals, setApprovals] = useState<any[]>([]);
  const [pending, setPending] = useState<{
    approved: any[];
    pending: any[];
    department_progress?: Array<{
      department_id: number;
      department: string;
      approved_count: number;
      total_count: number;
    }>;
    mode: string;
    required_count: number;
    conditions_met: boolean;
  } | null>(null);
  const [activeTransitionId, setActiveTransitionId] = useState<number | null>(null);
  const [allowedToApprove, setAllowedToApprove] = useState(false);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'error' | 'success' | 'warning' }>>([]);
  // Historical approvals (for completed transitions the task has moved past)
  const [historyPending, setHistoryPending] = useState<Array<{
    transitionId: number;
    label: string;
    data: {
      approved: any[];
      pending: any[];
      department_progress?: Array<{
        department_id: number;
        department: string;
        approved_count: number;
        total_count: number;
      }>;
      required_count: number;
      mode: string;
    };
  }>>([]);

  const getToken = () => localStorage.getItem('authToken');
  const showToast = (message: string, type: 'error' | 'success' | 'warning' = 'error') => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  };
  const removeToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));
  const parseArray = (value: any): any[] => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const fetchPending = useCallback(async (transitionId: number) => {
    try {
      const token = getToken();
      const data = await fetchJsonGetDedup<any>(
        `${API_BASE}/api/task-manager/approvals/task/${taskId}/pending?transition_id=${transitionId}`,
        token,
        500
      );
      if (data.success) setPending(data.data);
    } catch { /* ignore */ }
  }, [taskId]);

  // Resolve active transition for current status
  const resolveTransition = useCallback(async () => {
    try {
      const token = getToken();
      const [transRes, approvalsRes] = await Promise.all([
        fetchJsonGetDedup<any>(
          `${API_BASE}/api/task-manager/workflow/projects/${projectId}/transitions`,
          token,
          500
        ),
        fetchJsonGetDedup<any>(`${API_BASE}/api/task-manager/approvals/task/${taskId}`, token, 500),
      ]);
      const transData = transRes;
      const approvalsData = approvalsRes;
      if (!transData.success) return;

      const allTransitions = transData.data as any[];
      const allApprovals: any[] = approvalsData.success ? approvalsData.data : [];
      setApprovals(allApprovals);

      const activeCandidates = allTransitions.filter(
        (tr) => tr.from_status_id === statusId && tr.requires_approvals
      );
      const approvalsByTransition = allApprovals.reduce((acc: Record<number, number>, item: any) => {
        if (!item.transition_id) return acc;
        acc[item.transition_id] = (acc[item.transition_id] || 0) + 1;
        return acc;
      }, {});
      const approvedByCurrentUser = new Set(
        allApprovals
          .filter((a) => a.user_id === currentUserId && a.transition_id)
          .map((a) => a.transition_id)
      );

      const trans = activeCandidates.length > 0
        ? [...activeCandidates].sort((a, b) => {
          const aUser = approvedByCurrentUser.has(a.id) ? 1 : 0;
          const bUser = approvedByCurrentUser.has(b.id) ? 1 : 0;
          if (aUser !== bUser) return bUser - aUser;
          const aCount = approvalsByTransition[a.id] || 0;
          const bCount = approvalsByTransition[b.id] || 0;
          if (aCount !== bCount) return bCount - aCount;
          return a.id - b.id;
        })[0]
        : null;

      if (trans) {
        setHistoryPending([]);
        setActiveTransitionId(trans.id);
        await fetchPending(trans.id);

        // Check if current user is allowed to approve
        const approvers = parseArray(trans.required_approvers) as number[];
        const deptIds = parseArray(trans.approver_departments) as number[];
        const mode = trans.approval_mode || 'count';
        const currentUserDeptId = user?.department_id ?? null;

        if (mode === 'any_member' || (approvers.length === 0 && deptIds.length === 0)) {
          setAllowedToApprove(true);
        } else if (approvers.length > 0) {
          setAllowedToApprove(approvers.includes(currentUserId));
        } else if (deptIds.length > 0 && currentUserDeptId) {
          setAllowedToApprove(deptIds.includes(currentUserDeptId));
        } else {
          setAllowedToApprove(false);
        }
      } else {
        setPending(null);
        setActiveTransitionId(null);
        setAllowedToApprove(false);
        // No active approval transition — load history for past transitions
        // that have approval records for this task
        // Get unique past transition ids that have approvals
        const pastTransIds = [...new Set(allApprovals.map((a: any) => a.transition_id).filter(Boolean))];
        const history: typeof historyPending = [];

        for (const tid of pastTransIds) {
          const pendData = await fetchJsonGetDedup<any>(
            `${API_BASE}/api/task-manager/approvals/task/${taskId}/pending?transition_id=${tid}`,
            token,
            500
          );
          if (!pendData.success) continue;

          const transInfo = allTransitions.find((tr: any) => tr.id === tid);
          history.push({
            transitionId: tid,
            label: transInfo?.name || `Transition #${tid}`,
            data: pendData.data,
          });
        }
        setHistoryPending(history);
      }
    } catch { /* ignore */ }
  }, [projectId, statusId, currentUserId, fetchPending, taskId, user?.department_id]);

  useEffect(() => {
    resolveTransition();
  }, [resolveTransition]);

  const hasUserApproved = approvals.some((a) => a.user_id === currentUserId &&
    (activeTransitionId === null || a.transition_id === activeTransitionId));

  const parseApiResponse = async (res: Response): Promise<any> => {
    const raw = await res.text();
    try {
      return JSON.parse(raw);
    } catch {
      return {
        success: false,
        error: raw?.trim() || `HTTP ${res.status}`,
      };
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/task-manager/approvals/task/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ comment, transition_id: activeTransitionId }),
      });
      const data = await parseApiResponse(res);
      if (data.success) {
        const token = getToken();
        invalidateGetDedup(`${API_BASE}/api/task-manager/approvals/task/${taskId}`, token);
        if (activeTransitionId !== null) {
          invalidateGetDedup(
            `${API_BASE}/api/task-manager/approvals/task/${taskId}/pending?transition_id=${activeTransitionId}`,
            token
          );
        }
        setComment('');
        await resolveTransition();
        setTimeout(() => { if (onAutoTransition) onAutoTransition(); }, 500);
      } else {
        showToast(translateError(data.error || `HTTP ${res.status}`), 'error');
      }
    } catch (err: any) {
      console.error('Approval request failed:', err);
      showToast(
        translateError(err?.message || err?.toString?.() || t('approvalsError')),
        'error'
      );
    }
    finally { setLoading(false); }
  };

  const handleRevoke = async (transitionId: number | null = activeTransitionId) => {
    if (!confirm(t('approvalsRevokeConfirm'))) return;
    try {
      const res = await fetch(`${API_BASE}/api/task-manager/approvals/task/${taskId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ transition_id: transitionId }),
      });
      const data = await parseApiResponse(res);
      if (data.success) {
        const token = getToken();
        invalidateGetDedup(`${API_BASE}/api/task-manager/approvals/task/${taskId}`, token);
        if (transitionId !== null) {
          invalidateGetDedup(
            `${API_BASE}/api/task-manager/approvals/task/${taskId}/pending?transition_id=${transitionId}`,
            token
          );
        }
        await resolveTransition();
        if (onAutoTransition) onAutoTransition();
      } else {
        showToast(translateError(data.error || `HTTP ${res.status}`), 'error');
      }
    } catch (err: any) {
      console.error('Revoke request failed:', err);
      showToast(
        translateError(err?.message || err?.toString?.() || t('approvalsError')),
        'error'
      );
    }
  };

  const approvedCount = pending?.approved.length ?? approvals.filter((a) =>
    activeTransitionId === null || a.transition_id === activeTransitionId).length;
  const requiredCount = pending?.required_count ?? 0;

  return (
    <div className="space-y-3">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {/* Active approval block — only when task is in approval-required status */}
      {activeTransitionId !== null && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          {hasUserApproved ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium text-sm">{t('approvalsYouApproved')}</span>
                {requiredCount > 0 && (
                  <span className="text-xs text-green-600">({approvedCount}/{requiredCount})</span>
                )}
              </div>
              <button onClick={() => handleRevoke()} className="text-xs text-red-600 hover:text-red-700">
                {t('approvalsRevoke')}
              </button>
            </div>
          ) : allowedToApprove ? (
            <div className="space-y-2">
              <button onClick={handleApprove} disabled={loading}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm disabled:opacity-60">
                {t('approvalsApprove')}
                {requiredCount > 0 && ` (${approvedCount}/${requiredCount})`}
              </button>
              <input type="text" value={comment} onChange={(e) => setComment(e.target.value)}
                placeholder={t('approvalsCommentPlaceholder')}
                className="w-full px-3 py-1.5 border border-gray-200 rounded text-sm" />
            </div>
          ) : (
            <div className="text-center text-gray-500 py-2 text-sm">
              <svg className="w-7 h-7 mx-auto mb-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="font-medium">{t('approvalsNoPermission')}</p>
              {requiredCount > 0 && (
                <p className="text-xs mt-1">{approvedCount}/{requiredCount} {t('approvalsApprovedCount')}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Approved + Pending lists for active transition */}
      {pending && (pending.approved.length > 0 || pending.pending.length > 0) && (
        <ApprovalPendingBlock
          approved={pending.approved}
          pendingList={pending.pending}
          departmentProgress={pending.department_progress}
          t={t}
        />
      )}

      {/* Full approvals log (with comments) for active transition */}
      {activeTransitionId !== null && approvals.filter((a) => a.comment && a.transition_id === activeTransitionId).length > 0 && (
        <ApprovalsComments approvals={approvals.filter((a) => a.comment && a.transition_id === activeTransitionId)} t={t} language={i18n.language} />
      )}

      {/* ── Historical approvals (task has moved past approval step) ── */}
      {activeTransitionId === null && historyPending.length > 0 && (
        <div className="space-y-4">
      {historyPending.map((entry) => {
            const userApprovedEntry = entry.data.approved.some(
              (p: any) => p.user_id === currentUserId
            );
            return (
            <div key={entry.transitionId} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
                <svg className="w-4 h-4 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-xs font-semibold text-gray-700">{entry.label}</span>
                <span className="ml-auto text-xs text-gray-400">
                  {entry.data.approved.length}/{entry.data.required_count || entry.data.approved.length + entry.data.pending.length}
                </span>
                {userApprovedEntry && (
                  <button
                    onClick={() => handleRevoke(entry.transitionId)}
                    className="text-xs text-red-500 hover:text-red-700 ml-2 shrink-0"
                  >
                    {t('approvalsRevoke')}
                  </button>
                )}
              </div>
              <div className="p-2 space-y-1">
                <ApprovalPendingBlock
                  approved={entry.data.approved}
                  pendingList={entry.data.pending}
                  departmentProgress={entry.data.department_progress}
                  t={t}
                  compact
                />
              </div>
            </div>
            );
          })}
          {/* Comments from past approvals */}
          {approvals.filter((a) => a.comment).length > 0 && (
            <ApprovalsComments approvals={approvals.filter((a) => a.comment)} t={t} language={i18n.language} />
          )}
        </div>
      )}

      {/* No approvals at all */}
      {activeTransitionId === null && historyPending.length === 0 && approvals.length === 0 && (
        <div className="text-center text-gray-400 py-6 text-sm">
          <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>{t('approvalsNoApprovals')}</p>
        </div>
      )}
    </div>
  );
};

// ── Reusable approved/pending list block ──────────────────────────────────────
const ApprovalPendingBlock: React.FC<{
  approved: any[];
  pendingList: any[];
  departmentProgress?: Array<{
    department_id: number;
    department: string;
    approved_count: number;
    total_count: number;
  }>;
  t: (key: string, opts?: any) => string;
  compact?: boolean;
}> = ({ approved, pendingList, departmentProgress = [], t, compact }) => (
  <div className="space-y-2">
    {departmentProgress.length > 0 && (
      <div>
        {!compact && (
          <p className="text-xs font-semibold text-gray-500 mb-1.5">
            🏢 {t('approvalsDepartmentProgress')}
          </p>
        )}
        <div className="space-y-1">
          {departmentProgress.map((dept) => (
            <div key={dept.department_id} className="flex items-center gap-2.5 px-2 py-1.5 bg-blue-50 rounded-lg">
              <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 text-xs shrink-0">🏢</div>
              <span className="text-sm text-gray-700 truncate">{dept.department}</span>
              <span className="ml-auto text-xs font-semibold text-blue-700">
                {dept.approved_count}/{dept.total_count}
              </span>
            </div>
          ))}
        </div>
      </div>
    )}

    {approved.length > 0 && (
      <div>
        {!compact && (
          <p className="text-xs font-semibold text-gray-500 mb-1.5">
            ✅ {t('approvalsWhoApproved')} ({approved.length})
          </p>
        )}
        <div className="space-y-1">
          {approved.map((person: any, i: number) => (
            <div key={i} className="flex items-center gap-2.5 px-2 py-1.5 bg-green-50 rounded-lg">
              {person.user_id ? (
                <Avatar name={person.full_name || person.username || '?'}
                  imageUrl={`/avatar_${person.user_id}.png`} size="sm" className="shrink-0" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-green-200 flex items-center justify-center text-green-700 text-xs shrink-0">🏢</div>
              )}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-800 truncate block">
                  {person.full_name || person.username || person.department}
                </span>
                {person.department && person.user_id && (
                  <span className="text-xs text-gray-400">{person.department}</span>
                )}
              </div>
              <svg className="w-4 h-4 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          ))}
        </div>
      </div>
    )}

    {pendingList.length > 0 && (
      <div>
        {!compact && (
          <p className="text-xs font-semibold text-gray-500 mb-1.5">
            ⏳ {t('approvalsPending')} ({pendingList.length})
          </p>
        )}
        <div className="space-y-1">
          {pendingList.map((person: any, i: number) => (
            <div key={i} className="flex items-center gap-2.5 px-2 py-1.5 bg-gray-50 rounded-lg opacity-70">
              {person.type === 'department' ? (
                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs shrink-0">🏢</div>
              ) : (
                <Avatar name={person.full_name || person.username || '?'}
                  imageUrl={`/avatar_${person.user_id}.png`} size="sm" className="shrink-0" />
              )}
              <span className="text-sm text-gray-600 truncate">
                {person.department || person.full_name || person.username}
              </span>
              <svg className="w-4 h-4 text-gray-300 ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

// ── Approvals with comments ───────────────────────────────────────────────────
const ApprovalsComments: React.FC<{
  approvals: any[];
  t: (key: string, opts?: any) => string;
  language: string;
}> = ({ approvals, t, language }) => (
  <div>
    <p className="text-xs font-semibold text-gray-500 mb-1.5">{t('approvalsComments')}</p>
    <div className="space-y-1.5">
      {approvals.map((approval) => (
        <div key={approval.id} className="flex items-start gap-2.5 p-2.5 bg-gray-50 rounded-lg">
          <Avatar name={approval.full_name || approval.username}
            imageUrl={`/avatar_${approval.user_id}.png`} size="sm" />
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="font-medium text-sm text-gray-900">{approval.full_name || approval.username}</span>
              <span className="text-xs text-gray-400">
                {format(new Date(approval.approved_at), 'dd MMM, HH:mm', {
                  locale: language.startsWith('zh') ? zhCN : language.startsWith('ru') ? ru : enUS,
                })}
              </span>
            </div>
            <p className="text-sm text-gray-700">{approval.comment}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);
