import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectAttachments } from './hooks/useProjectAttachments';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import TaskManagerTranslation from './TaskManagerTranslation.json';

interface AttachmentsViewProps {
  projectId: number;
  onBackToProjects?: () => void;
  onOpenSettings?: () => void;
  viewType?: 'list' | 'grid' | 'attachments';
  onViewTypeChange?: (viewType: 'list' | 'grid' | 'attachments') => void;
  onTaskClick?: (taskId: number) => void;
}

const getFileIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) {
    return (
      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  
  if (mimeType.includes('pdf')) {
    return (
      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }
  
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return (
      <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
    return (
      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) {
    return (
      <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    );
  }
  
  // По умолчанию - обычный файл
  return (
    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const AttachmentsView: React.FC<AttachmentsViewProps> = ({ 
  projectId, 
  onBackToProjects, 
  onOpenSettings, 
  viewType, 
  onViewTypeChange,
  onTaskClick 
}) => {
  const { t, i18n } = useTranslation('taskManager');
  const { attachments, loading, error, downloadAttachment, deleteAttachment } = useProjectAttachments(projectId);
  const [filterBy, setFilterBy] = useState<'all' | 'images' | 'documents' | 'archives'>('all');
  const [sortBy, setSortBy] = useState<'uploaded_at' | 'file_name' | 'task_title' | 'task_created_at' | 'uploaded_by_name' | 'file_size'>('uploaded_at');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [taskFilter, setTaskFilter] = useState('');
  const [uploaderFilter, setUploaderFilter] = useState('');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Load translations for Task Manager
  React.useEffect(() => {
    const currentLang = i18n.language;
    if (TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(currentLang, 'taskManager', TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);

  // Закрытие меню сортировки при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setShowSortMenu(false);
      }
    };

    if (showSortMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSortMenu]);

  // Фильтрация и сортировка
  const filteredAndSortedAttachments = useMemo(() => {
    let filtered = attachments;

    // Поиск по названию файла или задачи
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(att => 
        att.file_name.toLowerCase().includes(query) ||
        att.task_title.toLowerCase().includes(query)
      );
    }

    // Фильтр по типу файла
    if (filterBy === 'images') {
      filtered = filtered.filter(att => att.mime_type.startsWith('image/'));
    } else if (filterBy === 'documents') {
      filtered = filtered.filter(att => 
        att.mime_type.includes('pdf') || 
        att.mime_type.includes('word') || 
        att.mime_type.includes('excel') ||
        att.mime_type.includes('document')
      );
    } else if (filterBy === 'archives') {
      filtered = filtered.filter(att => 
        att.mime_type.includes('zip') || 
        att.mime_type.includes('rar') ||
        att.mime_type.includes('archive')
      );
    }

    // Фильтр по дате загрузки
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter(att => {
        const uploadDate = new Date(att.uploaded_at);
        
        switch (dateFilter) {
          case 'today':
            return uploadDate >= today;
          case 'week':
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return uploadDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            return uploadDate >= monthAgo;
          case 'custom':
            if (customDateFrom && customDateTo) {
              const fromDate = new Date(customDateFrom);
              const toDate = new Date(customDateTo);
              toDate.setHours(23, 59, 59, 999); // Включить весь день
              return uploadDate >= fromDate && uploadDate <= toDate;
            }
            return true;
          default:
            return true;
        }
      });
    }

    // Фильтр по задаче
    if (taskFilter.trim()) {
      const query = taskFilter.toLowerCase();
      filtered = filtered.filter(att => 
        att.task_title.toLowerCase().includes(query) ||
        att.task_id.toString().includes(query)
      );
    }

    // Фильтр по загрузившему
    if (uploaderFilter.trim()) {
      const query = uploaderFilter.toLowerCase();
      filtered = filtered.filter(att => 
        att.uploaded_by_name.toLowerCase().includes(query)
      );
    }

    // Сортировка
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'file_name':
          return a.file_name.localeCompare(b.file_name);
        case 'task_title':
          return a.task_title.localeCompare(b.task_title);
        case 'uploaded_by_name':
          return a.uploaded_by_name.localeCompare(b.uploaded_by_name);
        case 'file_size':
          return b.file_size - a.file_size;
        case 'task_created_at':
          return new Date(b.task_created_at).getTime() - new Date(a.task_created_at).getTime();
        case 'uploaded_at':
        default:
          return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
      }
    });

    return filtered;
  }, [attachments, filterBy, sortBy, searchQuery, dateFilter, customDateFrom, customDateTo, taskFilter, uploaderFilter]);


  const handleDownload = async (attachment: any) => {
    try {
      await downloadAttachment(attachment.id, attachment.file_name);
    } catch (err) {
      console.error('Ошибка скачивания:', err);
    }
  };

  const handleDelete = async (attachment: any) => {
    if (window.confirm(`Удалить файл "${attachment.file_name}"?`)) {
      try {
        await deleteAttachment(attachment.id);
      } catch (err) {
        console.error('Ошибка удаления:', err);
      }
    }
  };

  if (loading && attachments.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">{t('attachmentsLoadingFiles')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">{t('attachmentsError')} {error}</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Панель управления */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3">
          {onBackToProjects && (
            <button
              onClick={onBackToProjects}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {t('back')}
            </button>
          )}
          
          {viewType && onViewTypeChange && (
            <div className="inline-flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => onViewTypeChange('list')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewType === 'list'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <button
                onClick={() => onViewTypeChange('grid')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewType === 'grid'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
              </button>
              <button
                onClick={() => onViewTypeChange('attachments')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewType === 'attachments'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          {/* ПОЛЯ ВВОДА - сначала все input поля */}
          
          {/* Поиск */}
          <div className="relative">
            <input
              type="text"
              placeholder={t('attachmentsSearch')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
            />
            <svg className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Фильтр по задаче */}
          <input
            type="text"
            placeholder={t('attachmentsTaskFilter')}
            value={taskFilter}
            onChange={(e) => setTaskFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-40"
          />

          {/* Фильтр по загрузившему */}
          <input
            type="text"
            placeholder={t('attachmentsUploaderFilter')}
            value={uploaderFilter}
            onChange={(e) => setUploaderFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-32"
          />

          {/* Кастомные даты (если выбраны) */}
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customDateFrom}
                onChange={(e) => setCustomDateFrom(e.target.value)}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="От"
              />
              <span className="text-gray-500">—</span>
              <input
                type="date"
                value={customDateTo}
                onChange={(e) => setCustomDateTo(e.target.value)}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="До"
              />
            </div>
          )}

          {/* СЕЛЕКТОРЫ - затем все select элементы */}
          
          {/* Фильтр по типу */}
          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value as any)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">{t('attachmentsAllFiles')}</option>
            <option value="images">{t('attachmentsImages')}</option>
            <option value="documents">{t('attachmentsDocuments')}</option>
            <option value="archives">{t('attachmentsArchives')}</option>
          </select>

          {/* Фильтр по дате */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">{t('attachmentsAllDates')}</option>
            <option value="today">{t('attachmentsToday')}</option>
            <option value="week">{t('attachmentsWeek')}</option>
            <option value="month">{t('attachmentsMonth')}</option>
            <option value="custom">{t('attachmentsPeriod')}</option>
          </select>

          {/* Сортировка */}
          <div className="relative" ref={sortMenuRef}>
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              title={t('attachmentsSortBy')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
            </button>
            
            {showSortMenu && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[200px]">
                <button
                  onClick={() => { setSortBy('uploaded_at'); setShowSortMenu(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                    sortBy === 'uploaded_at' ? 'bg-gray-50 font-medium' : ''
                  }`}
                >
                  <span>{t('attachmentsSortByUploadDate')}</span>
                  {sortBy === 'uploaded_at' && (
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => { setSortBy('file_name'); setShowSortMenu(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                    sortBy === 'file_name' ? 'bg-gray-50 font-medium' : ''
                  }`}
                >
                  <span>{t('attachmentsSortByFileName')}</span>
                  {sortBy === 'file_name' && (
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => { setSortBy('task_title'); setShowSortMenu(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                    sortBy === 'task_title' ? 'bg-gray-50 font-medium' : ''
                  }`}
                >
                  <span>{t('attachmentsSortByTaskTitle')}</span>
                  {sortBy === 'task_title' && (
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => { setSortBy('task_created_at'); setShowSortMenu(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                    sortBy === 'task_created_at' ? 'bg-gray-50 font-medium' : ''
                  }`}
                >
                  <span>{t('attachmentsSortByTaskCreated')}</span>
                  {sortBy === 'task_created_at' && (
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => { setSortBy('uploaded_by_name'); setShowSortMenu(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                    sortBy === 'uploaded_by_name' ? 'bg-gray-50 font-medium' : ''
                  }`}
                >
                  <span>{t('attachmentsSortByUploader')}</span>
                  {sortBy === 'uploaded_by_name' && (
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => { setSortBy('file_size'); setShowSortMenu(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                    sortBy === 'file_size' ? 'bg-gray-50 font-medium' : ''
                  }`}
                >
                  <span>{t('attachmentsSortByFileSize')}</span>
                  {sortBy === 'file_size' && (
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              </div>
            )}
          </div>
          
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              title={t('projectSettings')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Счетчик результатов */}
      {(searchQuery || filterBy !== 'all' || dateFilter !== 'all' || taskFilter || uploaderFilter) && (
        <div className="px-6 py-2 bg-blue-50 border-b border-blue-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-blue-700">
              {t('attachmentsFoundFiles')} <span className="font-medium">{filteredAndSortedAttachments.length}</span>
              {attachments.length !== filteredAndSortedAttachments.length && (
                <span className="text-blue-600"> {t('attachmentsOf')} {attachments.length}</span>
              )}
            </div>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterBy('all');
                setDateFilter('all');
                setCustomDateFrom('');
                setCustomDateTo('');
                setTaskFilter('');
                setUploaderFilter('');
              }}
              className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
            >
              {t('attachmentsResetFilters')}
            </button>
          </div>
        </div>
      )}

      {/* Контент */}
      <div className="flex-1 overflow-y-auto">
        {filteredAndSortedAttachments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2V7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
            <p className="text-lg font-medium">
              {attachments.length === 0 ? t('attachmentsNoFiles') : t('attachmentsFilesNotFound')}
            </p>
            <p className="text-sm">
              {attachments.length === 0 
                ? t('attachmentsNoFilesInProject')
                : t('attachmentsTryDifferentSearch')
              }
            </p>
          </div>
        ) : (
          <div className="bg-white">
            {/* Заголовок таблицы */}
            <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
              <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="col-span-1">{t('attachmentsFile')}</div>
                <div className="col-span-3">{t('attachmentsName')}</div>
                <div className="col-span-2">{t('attachmentsTask')}</div>
                <div className="col-span-2">{t('attachmentsTaskCreated')}</div>
                <div className="col-span-2">{t('attachmentsUploaded')}</div>
                <div className="col-span-1">{t('attachmentsUploadedBy')}</div>
                <div className="col-span-1">{t('attachmentsActions')}</div>
              </div>
            </div>

            {/* Строки файлов */}
            <div className="divide-y divide-gray-200">
              {filteredAndSortedAttachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="px-6 py-4 hover:bg-gray-50 transition-colors group"
                >
                  <div className="grid grid-cols-12 gap-4 items-center">
                    {/* Иконка файла */}
                    <div className="col-span-1">
                      {getFileIcon(attachment.mime_type)}
                    </div>

                    {/* Название файла */}
                    <div className="col-span-3">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {attachment.file_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(attachment.file_size)}
                      </p>
                    </div>

                    {/* Задача */}
                    <div className="col-span-2">
                      <button
                        onClick={() => onTaskClick?.(attachment.task_id)}
                        className="text-sm text-blue-600 hover:text-blue-800 transition-colors text-left"
                      >
                        #{attachment.task_id}: {attachment.task_title}
                      </button>
                    </div>

                    {/* Дата создания задачи */}
                    <div className="col-span-2">
                      <p className="text-sm text-gray-900">
                        {format(new Date(attachment.task_created_at), 'dd MMM yyyy', { locale: ru })}
                      </p>
                    </div>

                    {/* Дата загрузки */}
                    <div className="col-span-2">
                      <p className="text-sm text-gray-900">
                        {format(new Date(attachment.uploaded_at), 'dd MMM yyyy', { locale: ru })}
                      </p>
                    </div>

                    {/* Кто загрузил */}
                    <div className="col-span-1">
                      <p className="text-sm text-gray-900">
                        {attachment.uploaded_by_name}
                      </p>
                    </div>

                    {/* Действия */}
                    <div className="col-span-1">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleDownload(attachment)}
                          className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title={t('attachmentsDownload')}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(attachment)}
                          className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title={t('attachmentsDelete')}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
