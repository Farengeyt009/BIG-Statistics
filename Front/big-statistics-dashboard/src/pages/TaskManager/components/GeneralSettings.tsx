import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from './ui/Avatar';
import { useProjectMembers } from '../hooks/useProjectMembers';
import TaskManagerTranslation from '../TaskManagerTranslation.json';
import { fetchJsonGetDedup, invalidateGetDedup } from '../../../utils/fetchDedup';

interface GeneralSettingsProps {
  projectId: number;
  userRole: string;
  onProjectDeleted: () => void;
}

const API_BASE = '';

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({ projectId, userRole, onProjectDeleted }) => {
  const { t, i18n } = useTranslation('taskManager');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [ownerName, setOwnerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  // Transfer drawer state
  const [transferDrawer, setTransferDrawer] = useState(false);
  const [transferSearch, setTransferSearch] = useState('');
  const [selectedNewOwner, setSelectedNewOwner] = useState<{ id: number; name: string } | null>(null);

  const { members } = useProjectMembers(projectId);

  React.useEffect(() => {
    const currentLang = i18n.language;
    if (TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(currentLang, 'taskManager', TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);

  const getToken = () => localStorage.getItem('authToken');

  useEffect(() => {
    const fetchProject = async () => {
      setLoading(true);
      try {
        const token = getToken();
        const data = await fetchJsonGetDedup<any>(
          `${API_BASE}/api/task-manager/projects/${projectId}`,
          token,
          1000
        );
        if (data.success && data.data) {
          setProjectName(data.data.name || '');
          setProjectDescription(data.data.description || '');
          setOwnerId(data.data.owner_id);
          setOwnerName(data.data.owner_name || '');
        }
      } catch (err) {
        console.error('Ошибка загрузки проекта:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProject();
  }, [projectId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: projectName, description: projectDescription }),
      });
      const data = await response.json();
      if (data.success) {
        invalidateGetDedup(`${API_BASE}/api/task-manager/projects/${projectId}`, token);
        alert(t('generalSettingsSettingsSaved'));
      } else {
        alert(data.error || t('generalSettingsSaveError'));
      }
    } catch (err) {
      console.error('Ошибка:', err);
      alert(t('generalSettingsSaveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTransferConfirm = async () => {
    if (!selectedNewOwner) return;
    setIsTransferring(true);
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/projects/${projectId}/transfer-ownership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ new_owner_id: selectedNewOwner.id }),
      });
      const data = await response.json();
      if (data.success) {
        alert(t('generalSettingsTransferSuccess'));
        window.location.reload();
      } else {
        alert(data.error || t('generalSettingsTransferError'));
      }
    } catch (err) {
      console.error('Ошибка:', err);
      alert(t('generalSettingsTransferError'));
    } finally {
      setIsTransferring(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm(t('generalSettingsDeleteConfirm'))) return;
    if (!confirm(t('generalSettingsDeleteConfirmFinal'))) return;
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/api/task-manager/projects/${projectId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        onProjectDeleted();
      } else {
        alert(data.error || t('generalSettingsDeleteError'));
      }
    } catch (err) {
      console.error('Ошибка:', err);
      alert(t('generalSettingsDeleteProjectError'));
    }
  };

  const filteredMembers = members.filter(m => {
    if (m.user_id === ownerId) return false;
    const q = transferSearch.toLowerCase();
    return !q || (m.full_name || '').toLowerCase().includes(q) || (m.username || '').toLowerCase().includes(q);
  });

  const openTransferDrawer = () => {
    setSelectedNewOwner(null);
    setTransferSearch('');
    setTransferDrawer(true);
  };

  if (loading) {
    return <div className="text-center py-8">{t('generalSettingsLoading')}</div>;
  }

  return (
    <>
      <div className="flex justify-center">
        <div className="w-full max-w-xl space-y-3">

          {/* Project info */}
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">{t('generalSettingsBasicInfo')}</span>
            </div>
            <div className="px-4 py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('generalSettingsProjectName')}</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">{t('generalSettingsDescription')}</label>
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                  rows={4}
                  placeholder={t('generalSettingsDescPlaceholder')}
                />
              </div>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isSaving ? t('generalSettingsSaving') : t('generalSettingsSaveChanges')}
              </button>
            </div>
          </div>

          {/* Owner — only for owner */}
          {userRole === 'owner' && (
            <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-700">{t('generalSettingsProjectOwner')}</span>
              </div>
              <div className="px-4 py-3 flex items-center gap-3">
                <Avatar name={ownerName} imageUrl={ownerId ? `/avatar_${ownerId}.png` : undefined} size="sm" />
                <span className="text-sm font-medium text-gray-900 flex-1">{ownerName}</span>
                <button
                  onClick={openTransferDrawer}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors whitespace-nowrap"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  {t('generalSettingsTransferRights')}
                </button>
              </div>
            </div>
          )}

          {/* Danger zone — only for owner */}
          {userRole === 'owner' && (
            <div className="border border-red-200 rounded-xl bg-white overflow-hidden">
              <div className="px-4 py-2.5 bg-red-50 border-b border-red-100">
                <span className="text-sm font-semibold text-red-600">{t('generalSettingsDangerZone')}</span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">{t('generalSettingsDeleteProject')}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{t('generalSettingsDeleteWarning')}</div>
                </div>
                <button
                  onClick={handleDeleteProject}
                  className="shrink-0 px-4 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  {t('generalSettingsDeleteButton')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transfer ownership drawer */}
      {transferDrawer && (
        <div className="fixed inset-0 z-40" onClick={() => setTransferDrawer(false)} />
      )}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ${transferDrawer ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 shrink-0">
          <span className="text-sm font-semibold text-gray-800">{t('generalSettingsTransferRights')}</span>
          <button onClick={() => setTransferDrawer(false)} className="p-1 rounded-md hover:bg-gray-100 transition-colors">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Warning */}
        <div className="px-4 py-3 shrink-0 border-b border-gray-100">
          <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
            <span className="text-amber-500 text-sm shrink-0 mt-0.5">⚠️</span>
            <p className="text-xs text-amber-700 leading-relaxed">{t('generalSettingsTransferWarning')}</p>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-3 shrink-0 border-b border-gray-100">
          <input
            type="text"
            value={transferSearch}
            onChange={(e) => setTransferSearch(e.target.value)}
            placeholder={t('assigneeSelectorSearch')}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        {/* Members list */}
        <div className="flex-1 overflow-y-auto">
          {filteredMembers.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">{t('assigneeSelectorMembersNotFound')}</div>
          )}
          {filteredMembers.map(m => {
            const isSelected = selectedNewOwner?.id === m.user_id;
            return (
              <button
                key={m.user_id}
                onClick={() => setSelectedNewOwner(isSelected ? null : { id: m.user_id, name: m.full_name || m.username })}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                <Avatar name={m.full_name || m.username} imageUrl={`/avatar_${m.user_id}.png`} size="sm" />
                <span className="flex-1 font-medium text-gray-900 truncate">{m.full_name || m.username}</span>
                {isSelected && (
                  <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2 justify-end shrink-0">
          <button
            onClick={() => setTransferDrawer(false)}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleTransferConfirm}
            disabled={!selectedNewOwner || isTransferring}
            className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 rounded-md transition-colors"
          >
            {isTransferring ? '...' : t('confirm')}
          </button>
        </div>
      </div>
    </>
  );
};

