import React, { useState, useRef, useEffect } from 'react';
import { useStatusTranslation } from '../hooks/useStatusTranslation';
import { useTranslation } from 'react-i18next';

interface StatusSelectorProps {
  status: {
    id: number;
    name: string;
    color: string;
  };
  statuses: any[];
  taskId: number;
  onUpdate: (statusId: number) => void | Promise<void>;
  onError?: (msg: string) => void;
}

export const StatusSelector: React.FC<StatusSelectorProps> = ({ status, statuses, taskId, onUpdate, onError }) => {
  const { t } = useTranslation('taskManager');
  const { translateStatus } = useStatusTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = async (statusId: number) => {
    if (busy) return;
    setIsOpen(false);
    setBusy(true);
    try {
      await onUpdate(statusId);
    } catch (err) {
      if (onError) {
        onError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const systemStatusNames = ['Новая', 'В работе', 'Завершена', 'Отменена'];

  const currentStatusObj = { ...status, is_system: systemStatusNames.includes(status.name) || status.is_system };
  const currentDisplay = translateStatus(currentStatusObj);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!busy) setIsOpen(!isOpen);
        }}
        disabled={busy}
        className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-100 transition-colors disabled:opacity-60"
      >
        {busy ? (
          <svg className="w-3 h-3 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : (
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: status.color }}
          />
        )}
        <span className="text-xs text-gray-700 font-medium truncate whitespace-nowrap max-w-[120px] block">{currentDisplay}</span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[160px]">
          {statuses.map((s) => (
            <button
              key={s.id}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(s.id);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                s.id === status.id ? 'bg-gray-50' : ''
              }`}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-gray-900">{translateStatus(s)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

