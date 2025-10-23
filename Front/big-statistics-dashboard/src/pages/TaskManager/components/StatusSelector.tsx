import React, { useState, useRef, useEffect } from 'react';

interface StatusSelectorProps {
  status: {
    id: number;
    name: string;
    color: string;
  };
  statuses: any[];
  taskId: number;
  onUpdate: (statusId: number) => void;
}

export const StatusSelector: React.FC<StatusSelectorProps> = ({ status, statuses, taskId, onUpdate }) => {
  const [isOpen, setIsOpen] = useState(false);
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

  const handleSelect = (statusId: number) => {
    onUpdate(statusId);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: status.color }}
        />
        <span className="text-xs text-gray-700 font-medium">{status.name}</span>
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
              <span className="text-gray-900">{s.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

