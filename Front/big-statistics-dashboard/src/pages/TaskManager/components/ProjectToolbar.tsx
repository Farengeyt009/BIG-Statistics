import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, LayoutGrid, List, Table2, Paperclip, BookOpen, Settings, Plus, Eye, EyeOff, Filter, Download } from 'lucide-react';
import { SortSelector, SortOption } from './SortSelector';

export type ViewType = 'overview' | 'board' | 'list' | 'table' | 'files';

interface ProjectToolbarProps {
  projectName: string;
  viewType: ViewType;
  onViewTypeChange: (view: ViewType) => void;
  onBackToProjects: () => void;
  onOpenSettings: () => void;
  onCreateTask?: () => void;
  sortBy?: SortOption;
  onSortChange?: (sort: SortOption) => void;
  hideCompleted?: boolean;
  onHideCompletedChange?: (hide: boolean) => void;
  canManage?: boolean;
  settingsActive?: boolean;
  filterCount?: number;
  filterActive?: boolean;
  onFilterToggle?: () => void;
  onExport?: () => void;
}

const TABS: { id: ViewType; labelKey: string; icon: React.ElementType }[] = [
  { id: 'overview', labelKey: 'tabOverview', icon: BookOpen },
  { id: 'board',    labelKey: 'tabBoard', icon: LayoutGrid },
  { id: 'list',     labelKey: 'tabList', icon: List },
  { id: 'table',    labelKey: 'tabTable', icon: Table2 },
  { id: 'files',    labelKey: 'tabFiles', icon: Paperclip },
];

export const ProjectToolbar: React.FC<ProjectToolbarProps> = ({
  projectName,
  viewType,
  onViewTypeChange,
  onBackToProjects,
  onOpenSettings,
  onCreateTask,
  sortBy,
  onSortChange,
  hideCompleted,
  onHideCompletedChange,
  canManage = false,
  settingsActive = false,
  filterCount = 0,
  filterActive = false,
  onFilterToggle,
  onExport,
}) => {
  const { t } = useTranslation('taskManager');
  const showControls = viewType !== 'files' && viewType !== 'overview' && !settingsActive;
  return (
    <div className="grid grid-cols-3 items-center px-4 border-b border-gray-200 bg-white shrink-0">
      {/* Левая часть: назад + название */}
      <div className="flex items-center gap-2 py-3">
        <button
          onClick={onBackToProjects}
          className="flex items-center gap-1 text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>{t('back')}</span>
        </button>
        <span className="text-gray-300 select-none">/</span>
        <span className="text-base font-semibold text-gray-900 max-w-[260px] truncate" title={projectName}>
          {projectName}
        </span>
      </div>

      {/* Центр: вкладки — всегда по центру */}
      <div className="flex items-center justify-center">
        {TABS.map(({ id, labelKey, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onViewTypeChange(id)}
            className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors ${
              viewType === id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* Правая часть: фильтры + создать задачу + настройки */}
      <div className="flex items-center justify-end gap-2">
        {showControls && onSortChange && sortBy !== undefined && (
          <SortSelector value={sortBy} onChange={onSortChange} />
        )}
        {showControls && onFilterToggle && (
          <button
            onClick={onFilterToggle}
            className={`relative flex items-center gap-1.5 p-2 rounded-md transition-colors ${
              filterActive
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title={t('filterButton')}
          >
            <Filter className="w-4 h-4" />
            {filterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center bg-blue-600 text-white rounded-full text-[10px] font-bold">
                {filterCount}
              </span>
            )}
          </button>
        )}
        {showControls && onExport && (
          <button
            onClick={onExport}
            className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            title={t('exportExcel')}
          >
            <Download className="w-4 h-4" />
          </button>
        )}
        {showControls && onHideCompletedChange && hideCompleted !== undefined && (
          <button
            onClick={() => onHideCompletedChange(!hideCompleted)}
            className={`p-2 rounded-md transition-colors ${
              hideCompleted
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
            title={hideCompleted ? t('showCompleted') : t('hideCompleted')}
          >
            {hideCompleted ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
        {showControls && onCreateTask && (
          <button
            onClick={onCreateTask}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('taskModalCreateTask')}
          </button>
        )}
        {canManage && (
          <button
            onClick={onOpenSettings}
            className={`p-2 rounded-md transition-colors ${
              settingsActive
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
            title={t('projectSettings')}
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
