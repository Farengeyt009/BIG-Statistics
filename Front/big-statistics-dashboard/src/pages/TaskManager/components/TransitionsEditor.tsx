import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectMembers } from '../hooks/useProjectMembers';
import { useTransitions } from '../hooks/useTransitions';
import { useStatusTranslation } from '../hooks/useStatusTranslation';
import TaskManagerTranslation from '../TaskManagerTranslation.json';

interface TransitionsEditorProps {
  projectId: number;
  statuses: any[];
  onSave: () => void;
}

export const TransitionsEditor: React.FC<TransitionsEditorProps> = ({ projectId, statuses, onSave }) => {
  const { t, i18n } = useTranslation('taskManager');
  const { translateStatus } = useStatusTranslation();
  const { members } = useProjectMembers(projectId);
  const { transitions, deleteTransition, fetchTransitions } = useTransitions(projectId);
  const [showModal, setShowModal] = useState(false);
  const [editingTransition, setEditingTransition] = useState<any>(null);
  const [fromStatusId, setFromStatusId] = useState<number | null>(null);
  const [toStatusId, setToStatusId] = useState<number | null>(null);
  const [permissionType, setPermissionType] = useState<'roles' | 'users' | 'any'>('roles');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['member', 'admin', 'owner']);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isBidirectional, setIsBidirectional] = useState(true);
  const [requiresAttachment, setRequiresAttachment] = useState(false);
  const [requiresApprovals, setRequiresApprovals] = useState(false);
  const [requiredApprovalsCount, setRequiredApprovalsCount] = useState(3);
  const [selectedApprovers, setSelectedApprovers] = useState<number[]>([]);
  const [approverSearchQuery, setApproverSearchQuery] = useState('');
  const [autoTransition, setAutoTransition] = useState(false);

  // Load translations for Task Manager
  React.useEffect(() => {
    const currentLang = i18n.language;
    if (TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(currentLang, 'taskManager', TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);

  const roles = [
    { value: 'viewer', label: t('transitionsEditorViewer') },
    { value: 'member', label: t('transitionsEditorMember') },
    { value: 'admin', label: t('transitionsEditorAdmin') },
    { value: 'owner', label: t('transitionsEditorOwner') },
  ];

  const resetForm = () => {
    setFromStatusId(null);
    setToStatusId(null);
    setPermissionType('roles');
    setSelectedRoles(['member', 'admin', 'owner']);
    setSelectedUsers([]);
    setUserSearchQuery('');
    setIsBidirectional(true);
    setRequiresAttachment(false);
    setRequiresApprovals(false);
    setRequiredApprovalsCount(3);
    setSelectedApprovers([]);
    setApproverSearchQuery('');
    setAutoTransition(false);
  };

  const startEdit = (transition: any) => {
    setEditingTransition(transition);
    setFromStatusId(transition.from_status_id);
    setToStatusId(transition.to_status_id);
    setPermissionType(transition.permission_type || 'roles');
    setIsBidirectional(transition.is_bidirectional || false);
    setRequiresAttachment(transition.requires_attachment || false);
    setRequiresApprovals(transition.requires_approvals || false);
    setRequiredApprovalsCount(transition.required_approvals_count || 3);
    setAutoTransition(transition.auto_transition || false);
    
    // Загружаем список согласователей если есть
    if (transition.required_approvers) {
      try {
        const approvers = JSON.parse(transition.required_approvers);
        setSelectedApprovers(Array.isArray(approvers) ? approvers : []);
      } catch {
        setSelectedApprovers([]);
      }
    }
    
    // Очищаем старые значения
    setSelectedRoles([]);
    setSelectedUsers([]);
    
    // Загружаем текущие значения
    if (transition.permission_type === 'roles' && transition.allowed_roles) {
      try {
        const roles = JSON.parse(transition.allowed_roles);
        setSelectedRoles(Array.isArray(roles) ? roles : []);
      } catch (e) {
        setSelectedRoles([]);
      }
    } else if (transition.permission_type === 'users' && transition.allowed_users) {
      try {
        const users = JSON.parse(transition.allowed_users);
        setSelectedUsers(Array.isArray(users) ? users : []);
      } catch (e) {
        setSelectedUsers([]);
      }
    }
  };

  const handleSave = async () => {
    if (!fromStatusId || !toStatusId) {
      alert(t('validation.selectStatuses'));
      return;
    }

    const transitionData = {
      from_status_id: fromStatusId,
      to_status_id: toStatusId,
      permission_type: permissionType,
      allowed_roles: permissionType === 'roles' ? JSON.stringify(selectedRoles) : null,
      allowed_users: permissionType === 'users' ? JSON.stringify(selectedUsers) : null,
      is_bidirectional: isBidirectional,
      requires_attachment: requiresAttachment,
      requires_approvals: requiresApprovals,
      required_approvals_count: requiresApprovals ? requiredApprovalsCount : 0,
      required_approvers: requiresApprovals ? JSON.stringify(selectedApprovers) : null,
      auto_transition: autoTransition,
    };

    try {
      const token = localStorage.getItem('authToken');
      const url = editingTransition 
        ? `/api/task-manager/workflow/transitions/${editingTransition.id}`
        : `/api/task-manager/workflow/transitions`;
      
      const response = await fetch(url, {
        method: editingTransition ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(editingTransition ? transitionData : { ...transitionData, project_id: projectId }),
      });

      const data = await response.json();
      if (data.success) {
        setShowModal(false);
        setEditingTransition(null);
        resetForm();
        fetchTransitions();
        onSave();
      } else {
        alert(data.error || t('validation.saveError'));
      }
    } catch (err) {
      console.error('Ошибка:', err);
      alert(t('validation.saveTransitionError'));
    }
  };

  const filteredMembers = members.filter((member) => {
    if (!userSearchQuery.trim()) return true;
    const query = userSearchQuery.toLowerCase();
    const fullName = (member.full_name || '').toLowerCase();
    const username = (member.username || '').toLowerCase();
    return fullName.includes(query) || username.includes(query);
  });

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const toggleUser = (userId: number) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="mt-6 pt-6 border-t">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="font-semibold text-gray-900">{t('transitionsEditorTitle')}</h4>
          <p className="text-sm text-gray-500 mt-1">
            {t('transitionsEditorDescription')}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
        >
          + {t('transitionsEditorAddTransition')}
        </button>
      </div>

      {/* Список переходов */}
      {transitions.length > 0 ? (
        <div className="space-y-2">
          {transitions.map((transition) => {
            const permType = transition.permission_type;
            let permissionText = '';
            
            let fullPermissionText = '';
            
            if (permType === 'any') {
              permissionText = t('transitionsEditorAnyParticipant');
              fullPermissionText = permissionText;
            } else if (permType === 'roles') {
              const roles = transition.allowed_roles ? JSON.parse(transition.allowed_roles) : [];
              const roleLabels = roles.map((r: string) => {
                const labels: Record<string, string> = { 
                  owner: t('transitionsEditorOwner'), 
                  admin: t('transitionsEditorAdmin'), 
                  member: t('transitionsEditorMember'), 
                  viewer: t('transitionsEditorViewer') 
                };
                return labels[r] || r;
              });
              permissionText = roleLabels.join(', ');
              fullPermissionText = permissionText;
            } else if (permType === 'users') {
              const userIds = transition.allowed_users ? JSON.parse(transition.allowed_users) : [];
              const users = userIds.map((uid: number) => {
                const member = members.find(m => m.user_id === uid);
                return member?.full_name || member?.username || `#${uid}`;
              });
              fullPermissionText = users.join(', ');
              
              // Показываем только первых 2, остальных +N
              if (users.length > 2) {
                permissionText = `${users.slice(0, 2).join(', ')} +${users.length - 2}`;
              } else {
                permissionText = users.join(', ');
              }
            }

            return (
              <div
                key={transition.id}
                className="flex items-center justify-between p-3 border border-gray-200 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="text-sm flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {translateStatus(statuses.find((s: any) => s.id === transition.from_status_id) || { name: transition.from_status_name, is_system: false })}
                    </span>
                    {transition.is_bidirectional ? (
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" title={t('transitionsEditorBidirectionalTooltip')}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    )}
                    <span className="font-medium text-gray-900">
                      {translateStatus(statuses.find((s: any) => s.id === transition.to_status_id) || { name: transition.to_status_name, is_system: false })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div 
                      className="text-xs text-gray-600 px-2 py-1 bg-white rounded border border-gray-200 max-w-xs truncate"
                      title={fullPermissionText}
                    >
                      {permissionText}
                    </div>
                    {transition.requires_attachment && (
                      <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded flex items-center gap-1" title={t('transitionsEditorAttachmentTooltip')}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        {t('transitionsEditorFile')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      startEdit(transition);
                      setShowModal(true);
                    }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title={t('transitionsEditorEdit')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(t('validation.deleteTransitionConfirm'))) {
                        deleteTransition(transition.id);
                      }
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-gray-500 text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          {t('transitionsEditorNoTransitions')}
        </div>
      )}

      {/* Модалка настройки перехода */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">
              {editingTransition ? t('transitionsEditorEditTransition') : t('transitionsEditorConfigureTransition')}
            </h3>

            {/* Выбор статусов */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('transitionsEditorFromStatus')} *
                </label>
                <select
                  value={fromStatusId || ''}
                  onChange={(e) => setFromStatusId(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md"
                >
                  <option value="">{t('transitionsEditorSelect')}</option>
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('transitionsEditorToStatus')} *
                </label>
                <select
                  value={toStatusId || ''}
                  onChange={(e) => setToStatusId(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md"
                >
                  <option value="">{t('transitionsEditorSelect')}</option>
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Тип прав */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('transitionsEditorWhoCanTransfer')} *
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                  <input
                    type="radio"
                    checked={permissionType === 'any'}
                    onChange={() => setPermissionType('any')}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{t('transitionsEditorAnyMember')}</div>
                    <div className="text-xs text-gray-500">{t('transitionsEditorAnyMemberDesc')}</div>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                  <input
                    type="radio"
                    checked={permissionType === 'roles'}
                    onChange={() => setPermissionType('roles')}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{t('transitionsEditorByRoles')}</div>
                    <div className="text-xs text-gray-500">{t('transitionsEditorByRolesDesc')}</div>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                  <input
                    type="radio"
                    checked={permissionType === 'users'}
                    onChange={() => setPermissionType('users')}
                    className="w-4 h-4"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{t('transitionsEditorSpecificUsers')}</div>
                    <div className="text-xs text-gray-500">{t('transitionsEditorSpecificUsersDesc')}</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Выбор ролей */}
            {permissionType === 'roles' && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  {t('transitionsEditorSelectRoles')}
                </label>
                <div className="space-y-2">
                  {roles.map((role) => (
                    <label key={role.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(role.value)}
                        onChange={() => toggleRole(role.value)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">{role.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Выбор пользователей */}
            {permissionType === 'users' && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('transitionsEditorSelectUsers')}
                </label>
                
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder={t('transitionsEditorSearch')}
                  className="w-full px-3 py-2 border border-gray-200 rounded-md mb-2 text-sm"
                />

                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md">
                  {filteredMembers.map((member) => (
                    <label
                      key={member.user_id}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-white cursor-pointer border-b last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(member.user_id)}
                        onChange={() => toggleUser(member.user_id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-900">
                        {member.full_name || member.username}
                      </span>
                      <span className="text-xs text-gray-500">({member.role})</span>
                    </label>
                  ))}
                </div>

                <div className="mt-2 text-sm text-gray-600">
                  {t('transitionsEditorSelected')} {selectedUsers.length} {t('transitionsEditorUsers')}
                </div>
              </div>
            )}

            {/* Опции */}
            <div className="space-y-3 mb-6">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isBidirectional}
                    onChange={(e) => setIsBidirectional(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{t('transitionsEditorBidirectional')}</div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      {t('transitionsEditorBidirectionalDesc')}
                    </div>
                  </div>
                </label>
              </div>

              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requiresAttachment}
                    onChange={(e) => setRequiresAttachment(e.target.checked)}
                    className="w-4 h-4 text-orange-600 border-gray-300 rounded"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{t('transitionsEditorRequiresAttachment')}</div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      {t('transitionsEditorRequiresAttachmentDesc')}
                    </div>
                  </div>
                </label>
              </div>

              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input
                    type="checkbox"
                    checked={requiresApprovals}
                    onChange={(e) => setRequiresApprovals(e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{t('transitionsEditorRequiresApprovals')}</div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      {t('transitionsEditorRequiresApprovalsDesc')}
                    </div>
                  </div>
                </label>

                {requiresApprovals && (
                  <div className="mt-3 pl-6 space-y-3">
                    {/* Количество */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('transitionsEditorRequiredApprovals')}
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={requiredApprovalsCount}
                        onChange={(e) => setRequiredApprovalsCount(parseInt(e.target.value) || 1)}
                        className="w-24 px-2 py-1 border border-gray-200 rounded text-sm"
                      />
                    </div>

                    {/* Список согласователей */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('transitionsEditorWhoShouldApprove')}
                      </label>
                      <input
                        type="text"
                        value={approverSearchQuery}
                        onChange={(e) => setApproverSearchQuery(e.target.value)}
                        placeholder={t('transitionsEditorSearch')}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm mb-2"
                      />
                      
                      <div className="max-h-40 overflow-y-auto border border-gray-200 rounded bg-white">
                        {members
                          .filter((m) => {
                            if (!approverSearchQuery) return true;
                            const q = approverSearchQuery.toLowerCase();
                            return (m.full_name || '').toLowerCase().includes(q) || 
                                   (m.username || '').toLowerCase().includes(q);
                          })
                          .map((member) => (
                            <label
                              key={member.user_id}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                            >
                              <input
                                type="checkbox"
                                checked={selectedApprovers.includes(member.user_id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedApprovers([...selectedApprovers, member.user_id]);
                                  } else {
                                    setSelectedApprovers(selectedApprovers.filter(id => id !== member.user_id));
                                  }
                                }}
                                className="w-3 h-3"
                              />
                              <span className="text-sm">{member.full_name || member.username}</span>
                            </label>
                          ))}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {t('transitionsEditorSelected')} {selectedApprovers.length} {t('transitionsEditorUsers')}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoTransition}
                    onChange={(e) => setAutoTransition(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{t('transitionsEditorAutoTransition')}</div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      {t('transitionsEditorAutoTransitionDesc')}
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Кнопки */}
            <div className="flex gap-3 justify-end pt-4 border-t">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingTransition(null);
                  resetForm();
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
              >
                {t('transitionsEditorCancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={!fromStatusId || !toStatusId || (permissionType === 'roles' && selectedRoles.length === 0) || (permissionType === 'users' && selectedUsers.length === 0)}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {editingTransition ? t('transitionsEditorSaveChanges') : t('transitionsEditorSaveTransition')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

