import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from './components/ui/Avatar';
import { useProjectMembers } from './hooks/useProjectMembers';
import { CustomFieldsManager } from './components/CustomFieldsManager';
import { DefaultAssigneesSettings } from './components/DefaultAssigneesSettings';
import { WorkflowEditor } from './components/WorkflowEditor';
import { GeneralSettings } from './components/GeneralSettings';
import {
  Settings,
  Users,
  GitBranch,
  SlidersHorizontal,
  UserCheck,
  X,
  Check,
} from 'lucide-react';
import TaskManagerTranslation from './TaskManagerTranslation.json';

interface ProjectSettingsPageProps {
  projectId: number;
  userRole: string;
  onClose: () => void;
  onProjectDeleted?: () => void;
  onSettingsChange?: () => void;
}

type GroupedSettingsTab =
  | 'general'
  | 'members'
  | 'assignees'
  | 'workflow_states'
  | 'workflow_rules'
  | 'workflow_fields';

const MAIN_ITEMS: { id: GroupedSettingsTab; labelKey: string; icon: React.ElementType }[] = [
  { id: 'general', labelKey: 'projectSettingsGeneral', icon: Settings },
  { id: 'members', labelKey: 'projectSettingsMembers', icon: Users },
  { id: 'assignees', labelKey: 'projectSettingsAssignees', icon: UserCheck },
];

const WORKFLOW_ITEMS: { id: GroupedSettingsTab; labelKey: string; icon: React.ElementType }[] = [
  { id: 'workflow_states', labelKey: 'projectSettingsStates', icon: GitBranch },
  { id: 'workflow_rules', labelKey: 'projectSettingsRules', icon: GitBranch },
  { id: 'workflow_fields', labelKey: 'projectSettingsCustomFields', icon: SlidersHorizontal },
];

const roleColors: Record<string, string> = {
  owner:  'bg-purple-100 text-purple-700',
  admin:  'bg-blue-100 text-blue-700',
  member: 'bg-green-100 text-green-700',
  viewer: 'bg-gray-100 text-gray-600',
};

export const ProjectSettingsPage: React.FC<ProjectSettingsPageProps> = ({
  projectId,
  userRole,
  onClose,
  onProjectDeleted,
  onSettingsChange,
}) => {
  const { t, i18n } = useTranslation('taskManager');
  const [activeTab, setActiveTab] = useState<GroupedSettingsTab>('general');
  const { members, allUsers, loading, addMember, updateMemberRole, removeMember } = useProjectMembers(projectId);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState('member');
  const [searchQuery, setSearchQuery] = useState('');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<'full_name' | 'username' | 'department' | 'role' | 'added_at'>('full_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  React.useEffect(() => {
    const currentLang = i18n.language;
    if (TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(currentLang, 'taskManager', TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tmSettingsTab') as GroupedSettingsTab | null;
    const allItems = [...MAIN_ITEMS, ...WORKFLOW_ITEMS];
    if (tab && allItems.some((item) => item.id === tab)) {
      setActiveTab(tab);
    }
  }, []);

  React.useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('tmSettingsTab', activeTab);
    window.history.replaceState({}, '', url.toString());
  }, [activeTab]);

  const roleLabels: Record<string, string> = {
    owner:  t('projectSettingsOwner'),
    admin:  t('projectSettingsAdmin'),
    member: t('projectSettingsMember'),
    viewer: t('projectSettingsViewer'),
  };

  return (
    <div className="h-full flex flex-col bg-white">

      {/* Шапка */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            title={t('projectSettingsClose')}
          >
            <X className="w-4 h-4" />
          </button>
          <h2 className="text-base font-semibold text-gray-900">{t('projectSettingsTitle')}</h2>
        </div>
      </div>

      {/* Тело: левое меню + контент */}
      <div className="flex flex-1 overflow-hidden">

        {/* Левое меню */}
        <div className="w-52 shrink-0 border-r border-gray-200 bg-gray-50 py-3">
          <div className="px-4 pb-2 text-xs font-bold uppercase tracking-wide text-gray-500 leading-none">
            {t('projectSettingsMainGroup')}
          </div>
          {MAIN_ITEMS.map(({ id, labelKey, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left ${
                activeTab === id
                  ? 'bg-white text-blue-600 border-r-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {t(labelKey)}
              {id === 'members' && members.length > 0 && (
                <span className="ml-auto text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded-full">
                  {members.length}
                </span>
              )}
            </button>
          ))}

          <div className="mx-4 my-2 h-px bg-gray-200" />
          <div className="px-4 pt-1 pb-2 text-xs font-bold uppercase tracking-wide text-gray-500 leading-none">
            {t('projectSettingsWorkflowGroup')}
          </div>
          {WORKFLOW_ITEMS.map(({ id, labelKey, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left ${
                activeTab === id
                  ? 'bg-white text-blue-600 border-r-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {t(labelKey)}
            </button>
          ))}
        </div>

        {/* Правый контент */}
        <div className={`flex-1 overflow-y-auto ${activeTab.startsWith('workflow_') ? 'p-3' : 'p-6'}`}>

          {activeTab === 'general' && (
            <GeneralSettings
              projectId={projectId}
              userRole={userRole}
              onProjectDeleted={() => {
                onClose();
                if (onProjectDeleted) onProjectDeleted();
              }}
            />
          )}

          {activeTab === 'members' && (
            <div>
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">{t('projectSettingsMembers')}</h3>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      placeholder={t('projectSettingsSearchMember')}
                      className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-48"
                    />
                  </div>
                  <button
                    onClick={() => setShowAddMember(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    + {t('projectSettingsAddMember')}
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-8 text-gray-400 text-sm">{t('projectSettingsLoading')}</div>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[2fr_1.5fr_1.2fr_1fr_1fr_32px]">

                    {/* Header */}
                    {([ 
                      { labelKey: 'projectSettingsColFullName',    field: 'full_name'  },
                      { labelKey: 'projectSettingsColUsername',     field: 'username'   },
                      { labelKey: 'projectSettingsColDepartment',   field: 'department' },
                      { labelKey: 'projectSettingsRole',            field: 'role'       },
                      { labelKey: 'projectSettingsColJoiningDate',  field: 'added_at'   },
                    ] as { labelKey: string; field: typeof sortField }[]).map(({ labelKey, field }) => (
                      <button
                        key={field}
                        onClick={() => handleSort(field)}
                        className="px-4 py-2.5 text-xs font-medium text-gray-500 bg-gray-50 border-b border-gray-200 flex items-center gap-1 hover:text-gray-800 transition-colors text-left"
                      >
                        {t(labelKey)}
                        <svg className={`w-3 h-3 shrink-0 transition-colors ${sortField === field ? 'text-gray-600' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {sortField === field && sortDir === 'asc'
                            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            : sortField === field && sortDir === 'desc'
                            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                          }
                        </svg>
                      </button>
                    ))}
                    <div className="bg-gray-50 border-b border-gray-200" />

                    {/* Rows */}
                    {members
                      .filter((m) => {
                        if (!memberSearchQuery.trim()) return true;
                        const q = memberSearchQuery.toLowerCase();
                        return (m.full_name || '').toLowerCase().includes(q) ||
                               (m.username || '').toLowerCase().includes(q);
                      })
                      .sort((a, b) => {
                        const av = (a[sortField] || '') as string;
                        const bv = (b[sortField] || '') as string;
                        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
                      })
                      .map((member, idx, arr) => {
                        const isLast = idx === arr.length - 1;
                        const border = isLast ? '' : 'border-b border-gray-100';
                        return (
                          <React.Fragment key={member.id}>
                            {/* Full name */}
                            <div className={`px-4 py-3 flex items-center gap-3 min-w-0 ${border} hover:bg-gray-50 transition-colors group`}>
                              <Avatar name={member.full_name || member.username} imageUrl={`/avatar_${member.user_id}.png`} size="sm" />
                              <span className="text-sm font-medium text-gray-900 truncate">{member.full_name || member.username}</span>
                            </div>
                            {/* Username */}
                            <div className={`px-4 py-3 flex items-center ${border} hover:bg-gray-50 transition-colors`}>
                              <span className="text-sm text-gray-500 truncate">{member.username}</span>
                            </div>
                            {/* Department */}
                            <div className={`px-4 py-3 flex items-center ${border} hover:bg-gray-50 transition-colors`}>
                              <span className="text-sm text-gray-500 truncate">{member.department || '—'}</span>
                            </div>
                            {/* Role */}
                            <div className={`px-4 py-3 flex items-center ${border} hover:bg-gray-50 transition-colors`}>
                              {editingRoleId === member.id ? (
                                <div className="flex items-center gap-1.5">
                                  <select defaultValue={member.role}
                                    onChange={async (e) => { await updateMemberRole(member.user_id, e.target.value); setEditingRoleId(null); }}
                                    className="px-2 py-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none" autoFocus>
                                    <option value="viewer">{t('projectSettingsViewer')}</option>
                                    <option value="member">{t('projectSettingsMember')}</option>
                                    <option value="admin">{t('projectSettingsAdmin')}</option>
                                  </select>
                                  <button onClick={() => setEditingRoleId(null)} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => member.role !== 'owner' && setEditingRoleId(member.id)}
                                  disabled={member.role === 'owner'}
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[member.role] || roleColors.viewer} ${member.role !== 'owner' ? 'hover:opacity-75 cursor-pointer' : 'cursor-default'}`}
                                >
                                  {roleLabels[member.role] || member.role}
                                  {member.role !== 'owner' && <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>}
                                </button>
                              )}
                            </div>
                            {/* Joining date */}
                            <div className={`px-4 py-3 flex items-center ${border} hover:bg-gray-50 transition-colors`}>
                              <span className="text-sm text-gray-400">
                                {member.added_at ? new Date(member.added_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—'}
                              </span>
                            </div>
                            {/* Remove */}
                            <div className={`py-3 flex items-center justify-center ${border} hover:bg-gray-50 transition-colors`}>
                              {member.role !== 'owner' && (
                                <button
                                  onClick={() => { if (confirm(t('projectSettingsConfirmRemove').replace('{{name}}', member.full_name || member.username))) removeMember(member.user_id); }}
                                  className="p-1 text-gray-300 hover:text-red-500 transition-colors rounded"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </React.Fragment>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'workflow_states' && (
            <WorkflowEditor projectId={projectId} onStatusChange={onSettingsChange} mode="states" />
          )}

          {activeTab === 'workflow_rules' && (
            <WorkflowEditor projectId={projectId} onStatusChange={onSettingsChange} mode="rules" />
          )}

          {activeTab === 'workflow_fields' && (
            <CustomFieldsManager projectId={projectId} />
          )}

          {activeTab === 'assignees' && (
            <DefaultAssigneesSettings projectId={projectId} />
          )}
        </div>
      </div>

      {/* Backdrop */}
      {showAddMember && <div className="fixed inset-0 z-40 bg-black/20" onClick={() => { setShowAddMember(false); setSelectedUserId(null); setSelectedRole('member'); setSearchQuery(''); }} />}

      {/* Add member drawer */}
      <div className={`fixed top-0 right-0 h-full bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ${showAddMember ? 'translate-x-0' : 'translate-x-full'}`} style={{ width: 340 }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">{t('projectSettingsAddMemberTitle')}</h3>
          <button
            onClick={() => { setShowAddMember(false); setSelectedUserId(null); setSelectedRole('member'); setSearchQuery(''); }}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Role */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('projectSettingsRole')} *</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="viewer">{t('projectSettingsViewer')}</option>
              <option value="member">{t('projectSettingsMember')}</option>
              <option value="admin">{t('projectSettingsAdmin')}</option>
            </select>
          </div>

          {/* Search user */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('projectSettingsFindUser')} *</label>
            <div className="relative mb-2">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('projectSettingsSearchByName')}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                autoFocus
              />
            </div>
            <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {allUsers
                .filter((u) => !members.some((m) => m.user_id === u.user_id))
                .filter((u) => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  return (u.full_name || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q);
                })
                .map((user) => (
                  <button
                    key={user.user_id}
                    onClick={() => setSelectedUserId(user.user_id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left ${selectedUserId === user.user_id ? 'bg-blue-50' : ''}`}
                  >
                    <Avatar name={user.full_name || user.username} imageUrl={`/avatar_${user.user_id}.png`} size="sm" />
                    <span className="text-sm font-medium text-gray-900 truncate flex-1">{user.full_name || user.username}</span>
                    {selectedUserId === user.user_id && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                  </button>
                ))}
              {allUsers.filter((u) => !members.some((m) => m.user_id === u.user_id)).length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-gray-400">{t('projectSettingsAllUsersAdded')}</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100">
          <div className="flex gap-2">
            <button
              onClick={() => { setShowAddMember(false); setSelectedUserId(null); setSelectedRole('member'); setSearchQuery(''); }}
              className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t('projectSettingsCancel')}
            </button>
            <button
              onClick={async () => {
                if (!selectedUserId) { alert(t('projectSettingsSelectUser')); return; }
                const success = await addMember(selectedUserId, selectedRole);
                if (success) { setShowAddMember(false); setSelectedUserId(null); setSelectedRole('member'); setSearchQuery(''); }
              }}
              disabled={!selectedUserId}
              className="flex-1 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {t('projectSettingsAdd')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
