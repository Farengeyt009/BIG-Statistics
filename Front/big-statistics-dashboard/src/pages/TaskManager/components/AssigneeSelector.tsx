import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectMembers } from '../hooks/useProjectMembers';
import { Avatar } from './ui/Avatar';
import TaskManagerTranslation from '../TaskManagerTranslation.json';

interface AssigneeSelectorProps {
  projectId: number;
  assigneeId?: number;
  assigneeName?: string;
  onUpdate: (assigneeId: number | null) => void;
}

export const AssigneeSelector: React.FC<AssigneeSelectorProps> = ({
  projectId,
  assigneeId,
  assigneeName,
  onUpdate,
}) => {
  const { t, i18n } = useTranslation('taskManager');
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { members } = useProjectMembers(projectId);

  // Load translations for Task Manager
  React.useEffect(() => {
    const currentLang = i18n.language;
    if (TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(currentLang, 'taskManager', TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);

  // Находим участника по ID если имя не передано
  const currentMember = assigneeId 
    ? members.find(m => m.user_id === assigneeId)
    : null;
  const displayName = assigneeName || currentMember?.full_name || currentMember?.username;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredMembers = members.filter((member) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const fullName = (member.full_name || '').toLowerCase();
    const username = (member.username || '').toLowerCase();
    return fullName.includes(query) || username.includes(query);
  });

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-md hover:border-gray-300 focus:ring-2 focus:ring-blue-500 text-sm text-left transition-colors"
      >
        {displayName ? (
          <div className="flex items-center gap-2">
            <Avatar 
              name={displayName} 
              imageUrl={assigneeId ? `/avatar_${assigneeId}.png` : undefined}
              size="sm"
            />
            <span className="text-gray-900">{displayName}</span>
          </div>
        ) : (
          <span className="text-gray-500">{t('assigneeSelectorNotAssigned')}</span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-80 overflow-hidden flex flex-col">
          {/* Поиск */}
          <div className="p-2 border-b">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('assigneeSelectorSearch')}
              className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Список */}
          <div className="overflow-y-auto">
            {/* Опция "Не назначен" */}
            <button
              onClick={() => {
                onUpdate(null);
                setIsOpen(false);
                setSearchQuery('');
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                !assigneeId ? 'bg-blue-50' : ''
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <span className="text-gray-700">{t('assigneeSelectorNotAssigned')}</span>
              {!assigneeId && (
                <svg className="w-4 h-4 ml-auto text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>

            {/* Участники */}
            {filteredMembers.map((member) => (
              <button
                key={member.user_id}
                onClick={() => {
                  onUpdate(member.user_id);
                  setIsOpen(false);
                  setSearchQuery('');
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                  assigneeId === member.user_id ? 'bg-blue-50' : ''
                }`}
              >
                <Avatar 
                  name={member.full_name || member.username} 
                  imageUrl={`/avatar_${member.user_id}.png`}
                  size="sm"
                />
                <div className="flex-1 text-left">
                  <div className="font-medium text-gray-900">
                    {member.full_name || member.username}
                  </div>
                  <div className="text-xs text-gray-500">{member.username}</div>
                </div>
                {assigneeId === member.user_id && (
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}

            {filteredMembers.length === 0 && (
              <div className="p-4 text-center text-sm text-gray-500">
                {t('assigneeSelectorMembersNotFound')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

