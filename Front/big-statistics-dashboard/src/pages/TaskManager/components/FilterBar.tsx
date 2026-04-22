import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ChevronDown } from 'lucide-react';
import { TaskFilters, EMPTY_FILTERS } from '../types/filters';
import { useProjectMembers } from '../hooks/useProjectMembers';
import { useStatusTranslation } from '../hooks/useStatusTranslation';
import { useTasks } from '../hooks/useTasks';
import { PriorityIcon } from './PrioritySelector';
import { Avatar } from './ui/Avatar';

interface FilterBarProps {
  projectId: number;
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
}

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

function FilterDropdown({
  label,
  activeCount,
  children,
  open,
  onToggle,
  dropdownRef,
}: {
  label: string;
  activeCount: number;
  children: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={onToggle}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors ${
          activeCount > 0
            ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
        }`}
      >
        {label}
        {activeCount > 0 && (
          <span className="w-4 h-4 flex items-center justify-center bg-blue-600 text-white rounded-full text-[10px] font-bold">
            {activeCount}
          </span>
        )}
        <ChevronDown className={`w-3 h-3 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-56 py-1">
          {children}
        </div>
      )}
    </div>
  );
}

function CheckItem({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left"
    >
      <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all ${
        checked ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
      }`}>
        {checked && (
          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      {children}
    </button>
  );
}

export const FilterBar: React.FC<FilterBarProps> = ({ projectId, filters, onChange }) => {
  const { t } = useTranslation('taskManager');
  const { translateStatus } = useStatusTranslation();
  const { statuses } = useTasks(projectId);
  const { members } = useProjectMembers(projectId);

  const [openDropdown, setOpenDropdown] = React.useState<'status' | 'priority' | 'assignee' | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const priorityRef = useRef<HTMLDivElement>(null);
  const assigneeRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  React.useEffect(() => {
    const h = (e: MouseEvent) => {
      const refs = [statusRef, priorityRef, assigneeRef];
      if (refs.every(r => !r.current?.contains(e.target as Node))) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggle = (dropdown: typeof openDropdown) =>
    setOpenDropdown(prev => (prev === dropdown ? null : dropdown));

  const toggleStatus = (id: number) => {
    const next = filters.statuses.includes(id)
      ? filters.statuses.filter(s => s !== id)
      : [...filters.statuses, id];
    onChange({ ...filters, statuses: next });
  };

  const togglePriority = (p: string) => {
    const next = filters.priorities.includes(p)
      ? filters.priorities.filter(x => x !== p)
      : [...filters.priorities, p];
    onChange({ ...filters, priorities: next });
  };

  const toggleAssignee = (id: number | 'unassigned') => {
    const next = filters.assigneeIds.includes(id)
      ? filters.assigneeIds.filter(x => x !== id)
      : [...filters.assigneeIds, id];
    onChange({ ...filters, assigneeIds: next });
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-white flex-wrap">
      {/* Status filter */}
      <FilterDropdown
        label={t('filterStatus')}
        activeCount={filters.statuses.length}
        open={openDropdown === 'status'}
        onToggle={() => toggle('status')}
        dropdownRef={statusRef}
      >
        {statuses.map(s => (
          <CheckItem key={s.id} checked={filters.statuses.includes(s.id)} onChange={() => toggleStatus(s.id)}>
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="truncate text-gray-700">{translateStatus(s)}</span>
          </CheckItem>
        ))}
      </FilterDropdown>

      {/* Priority filter */}
      <FilterDropdown
        label={t('filterPriority')}
        activeCount={filters.priorities.length}
        open={openDropdown === 'priority'}
        onToggle={() => toggle('priority')}
        dropdownRef={priorityRef}
      >
        {PRIORITIES.map(p => (
          <CheckItem key={p} checked={filters.priorities.includes(p)} onChange={() => togglePriority(p)}>
            <PriorityIcon priority={p} />
            <span className="text-gray-700">{t(`priority${p.charAt(0).toUpperCase() + p.slice(1)}`)}</span>
          </CheckItem>
        ))}
      </FilterDropdown>

      {/* Assignee filter */}
      <FilterDropdown
        label={t('filterAssignee')}
        activeCount={filters.assigneeIds.length}
        open={openDropdown === 'assignee'}
        onToggle={() => toggle('assignee')}
        dropdownRef={assigneeRef}
      >
        <CheckItem checked={filters.assigneeIds.includes('unassigned')} onChange={() => toggleAssignee('unassigned')}>
          <span className="text-gray-500 italic">{t('filterUnassigned')}</span>
        </CheckItem>
        {members.map(m => (
          <CheckItem key={m.user_id} checked={filters.assigneeIds.includes(m.user_id)} onChange={() => toggleAssignee(m.user_id)}>
            <Avatar name={m.full_name || m.username} imageUrl={`/avatar_${m.user_id}.png`} size="sm" />
            <span className="truncate text-gray-700">{m.full_name || m.username}</span>
          </CheckItem>
        ))}
      </FilterDropdown>

      {/* Active filter chips */}
      {filters.statuses.map(id => {
        const s = statuses.find(x => x.id === id);
        if (!s) return null;
        return (
          <span key={`s-${id}`} className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
            {translateStatus(s)}
            <button onClick={() => toggleStatus(id)} className="ml-0.5 hover:text-red-500 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </span>
        );
      })}
      {filters.priorities.map(p => (
        <span key={`p-${p}`} className="flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
          <PriorityIcon priority={p} />
          {t(`priority${p.charAt(0).toUpperCase() + p.slice(1)}`)}
          <button onClick={() => togglePriority(p)} className="ml-0.5 hover:text-red-500 transition-colors">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      {filters.assigneeIds.map(id => {
        const label = id === 'unassigned'
          ? t('filterUnassigned')
          : (members.find(m => m.user_id === id)?.full_name || members.find(m => m.user_id === id)?.username || '');
        return (
          <span key={`a-${id}`} className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
            {label}
            <button onClick={() => toggleAssignee(id)} className="ml-0.5 hover:text-red-500 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </span>
        );
      })}

      {/* Clear all */}
      {(filters.statuses.length > 0 || filters.priorities.length > 0 || filters.assigneeIds.length > 0) && (
        <button
          onClick={() => onChange(EMPTY_FILTERS)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors ml-1"
        >
          <X className="w-3.5 h-3.5" />
          {t('filterClearAll')}
        </button>
      )}
    </div>
  );
};
