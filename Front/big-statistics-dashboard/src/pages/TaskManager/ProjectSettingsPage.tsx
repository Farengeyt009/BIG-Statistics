import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from './components/ui/Avatar';
import { useProjectMembers } from './hooks/useProjectMembers';
import { CustomFieldsManager } from './components/CustomFieldsManager';
import { DefaultAssigneesSettings } from './components/DefaultAssigneesSettings';
import { WorkflowEditor } from './components/WorkflowEditor';
import { GeneralSettings } from './components/GeneralSettings';
import { useNavigate } from 'react-router-dom';
import TaskManagerTranslation from './TaskManagerTranslation.json';

interface ProjectSettingsPageProps {
  projectId: number;
  userRole: string;
  onClose: () => void;
  onProjectDeleted?: () => void;
  onSettingsChange?: () => void;
}

export const ProjectSettingsPage: React.FC<ProjectSettingsPageProps> = ({ projectId, userRole, onClose, onProjectDeleted, onSettingsChange }) => {
  const { t, i18n } = useTranslation('taskManager');
  const [activeTab, setActiveTab] = useState<'general' | 'members' | 'workflow' | 'fields' | 'assignees'>('members');
  const { members, allUsers, loading, addMember, updateMemberRole, removeMember } = useProjectMembers(projectId);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState('member');
  const [searchQuery, setSearchQuery] = useState('');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);

  // Load translations for Task Manager
  React.useEffect(() => {
    const currentLang = i18n.language;
    if (TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(currentLang, 'taskManager', TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);

  const roleLabels: Record<string, string> = {
    owner: t('projectSettingsOwner'),
    admin: t('projectSettingsAdmin'),
    member: t('projectSettingsMember'),
    viewer: t('projectSettingsViewer'),
  };

  const roleColors: Record<string, string> = {
    owner: 'bg-purple-100 text-purple-700',
    admin: 'bg-blue-100 text-blue-700',
    member: 'bg-green-100 text-green-700',
    viewer: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-lg w-full max-w-4xl h-[85vh] overflow-hidden flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">{t('projectSettingsTitle')}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex gap-1 px-6">
            <button
              onClick={() => setActiveTab('general')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'general'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              {t('projectSettingsGeneral')}
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'members'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              {t('projectSettingsMembers')} ({members.length})
            </button>
            <button
              onClick={() => setActiveTab('workflow')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'workflow'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              {t('projectSettingsWorkflow')}
            </button>
            <button
              onClick={() => setActiveTab('fields')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'fields'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              {t('projectSettingsCustomFields')}
            </button>
            <button
              onClick={() => setActiveTab('assignees')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'assignees'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              {t('projectSettingsAssignees')}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'members' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{t('projectSettingsProjectMembers')}</h3>
                <button
                  onClick={() => setShowAddMember(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  + {t('projectSettingsAddMember')}
                </button>
              </div>

              {/* Поиск участников */}
              <div className="mb-4">
                <input
                  type="text"
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  placeholder={t('projectSettingsSearchMember')}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {loading ? (
                <div className="text-center py-8 text-gray-500">{t('projectSettingsLoading')}</div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {members
                    .filter((member) => {
                      if (!memberSearchQuery.trim()) return true;
                      const query = memberSearchQuery.toLowerCase();
                      const fullName = (member.full_name || '').toLowerCase();
                      const username = (member.username || '').toLowerCase();
                      return fullName.includes(query) || username.includes(query);
                    })
                    .map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4 border border-gray-200 bg-white rounded-lg hover:border-gray-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar 
                          name={member.full_name || member.username} 
                          imageUrl={`/avatar_${member.user_id}.png`}
                          size="md" 
                        />
                        <div>
                          <div className="font-medium text-gray-900">
                            {member.full_name || member.username}
                          </div>
                          <div className="text-sm text-gray-500">
                            {member.username}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Изменение роли */}
                        {editingRoleId === member.id ? (
                          <div className="flex items-center gap-2">
                            <select
                              defaultValue={member.role}
                              onChange={async (e) => {
                                await updateMemberRole(member.user_id, e.target.value);
                                setEditingRoleId(null);
                              }}
                              className="px-2 py-1 border border-gray-200 rounded text-xs"
                              autoFocus
                            >
                              <option value="viewer">{t('projectSettingsViewer')}</option>
                              <option value="member">{t('projectSettingsMember')}</option>
                              <option value="admin">{t('projectSettingsAdmin')}</option>
                            </select>
                            <button
                              onClick={() => setEditingRoleId(null)}
                              className="text-xs text-gray-500 hover:text-gray-700"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => member.role !== 'owner' && setEditingRoleId(member.id)}
                            disabled={member.role === 'owner'}
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              roleColors[member.role] || roleColors.viewer
                            } ${member.role !== 'owner' ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
                            title={member.role !== 'owner' ? t('projectSettingsClickToChangeRole') : ''}
                          >
                            {roleLabels[member.role] || member.role}
                          </button>
                        )}

                        {member.role !== 'owner' && (
                          <button
                            onClick={() => {
                              if (confirm(`${t('projectSettingsConfirmRemoveMember')} ${member.full_name || member.username}?`)) {
                                removeMember(member.user_id);
                              }
                            }}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            title={t('projectSettingsRemoveMember')}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'general' && (
            <GeneralSettings 
              projectId={projectId} 
              userRole={userRole}
              onProjectDeleted={() => {
                onClose();
                if (onProjectDeleted) {
                  onProjectDeleted();
                }
              }}
            />
          )}

          {activeTab === 'workflow' && (
            <WorkflowEditor projectId={projectId} onStatusChange={onSettingsChange} />
          )}

          {activeTab === 'fields' && (
            <CustomFieldsManager projectId={projectId} />
          )}

          {activeTab === 'assignees' && (
            <DefaultAssigneesSettings projectId={projectId} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('projectSettingsClose')}
          </button>
        </div>
      </div>

      {/* Модалка добавления участника */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-xl font-semibold mb-4">{t('projectSettingsAddMemberTitle')}</h3>

            {/* Поиск пользователя */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('projectSettingsSearchUser')}
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('projectSettingsStartTyping')}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 mb-2"
              />
              
              {/* Список пользователей */}
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md">
                {allUsers
                  .filter((user) => !members.some((m) => m.user_id === user.user_id))
                  .filter((user) => {
                    if (!searchQuery.trim()) return true;
                    const query = searchQuery.toLowerCase();
                    const fullName = (user.full_name || '').toLowerCase();
                    const username = (user.username || '').toLowerCase();
                    return fullName.includes(query) || username.includes(query);
                  })
                  .map((user) => (
                    <button
                      key={user.user_id}
                      onClick={() => setSelectedUserId(user.user_id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                        selectedUserId === user.user_id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <Avatar 
                        name={user.full_name || user.username} 
                        imageUrl={`/avatar_${user.user_id}.png`}
                        size="sm" 
                      />
                      <div className="flex-1 text-left">
                        <div className="font-medium text-gray-900 text-sm">
                          {user.full_name || user.username}
                        </div>
                        <div className="text-xs text-gray-500">{user.username}</div>
                      </div>
                      {selectedUserId === user.user_id && (
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                {allUsers.filter((user) => !members.some((m) => m.user_id === user.user_id)).length === 0 && (
                  <div className="p-4 text-center text-sm text-gray-500">
                    {t('projectSettingsAllUsersAdded')}
                  </div>
                )}
              </div>
            </div>

            {/* Выбор роли */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('projectSettingsRole')}
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="viewer">{t('projectSettingsViewer')}</option>
                <option value="member">{t('projectSettingsMember')}</option>
                <option value="admin">{t('projectSettingsAdmin')}</option>
              </select>
            </div>

            {/* Кнопки */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowAddMember(false);
                  setSelectedUserId(null);
                  setSelectedRole('member');
                  setSearchQuery('');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
              >
                {t('projectSettingsCancel')}
              </button>
              <button
                onClick={async () => {
                  if (!selectedUserId) {
                    alert(t('projectSettingsSelectUser'));
                    return;
                  }
                  const success = await addMember(selectedUserId, selectedRole);
                  if (success) {
                    setShowAddMember(false);
                    setSelectedUserId(null);
                    setSelectedRole('member');
                    setSearchQuery('');
                  }
                }}
                disabled={!selectedUserId}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {t('projectSettingsAdd')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

