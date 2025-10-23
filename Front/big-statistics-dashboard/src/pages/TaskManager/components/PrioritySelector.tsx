import React, { useState, useRef, useEffect } from 'react';

interface PrioritySelectorProps {
  priority: string;
  taskId: number;
  onUpdate: (priority: string) => void;
}

const priorities = [
  { value: 'low', label: 'Низкий', icon: '◔', color: '#10b981' },
  { value: 'medium', label: 'Средний', icon: '◑', color: '#f59e0b' },
  { value: 'high', label: 'Высокий', icon: '◕', color: '#ef4444' },
  { value: 'critical', label: 'Критический', icon: '●', color: '#7c3aed' },
];

export const PrioritySelector: React.FC<PrioritySelectorProps> = ({ priority, taskId, onUpdate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentPriority = priorities.find((p) => p.value === priority) || priorities[1];

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

  const handleSelect = (value: string) => {
    onUpdate(value);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-gray-100 transition-colors"
        title={currentPriority.label}
      >
        <span
          className="text-sm font-medium"
          style={{ color: currentPriority.color }}
        >
          {currentPriority.icon}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[160px]">
          {priorities.map((p) => (
            <button
              key={p.value}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(p.value);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                p.value === priority ? 'bg-gray-50' : ''
              }`}
            >
              <span style={{ color: p.color }} className="font-medium">
                {p.icon}
              </span>
              <span className="text-gray-900">{p.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

