import React, { useState, useRef, useEffect } from 'react';

interface TaskContextMenuProps {
  task: any;
  statuses: any[];
  onUpdate: (updates: any) => void;
  onDelete: () => void;
  onOpen: () => void;
  position: { x: number; y: number } | null;
  onClose: () => void;
}

export const TaskContextMenu: React.FC<TaskContextMenuProps> = ({
  task,
  statuses,
  onUpdate,
  onDelete,
  onOpen,
  position,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (position) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [position, onClose]);

  if (!position) return null;

  const menuItems = [
    {
      label: 'Открыть',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      onClick: () => {
        onOpen();
        onClose();
      },
    },
    {
      label: 'Изменить приоритет',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      submenu: [
        { label: '◔ Низкий', value: 'low' },
        { label: '◑ Средний', value: 'medium' },
        { label: '◕ Высокий', value: 'high' },
        { label: '● Критический', value: 'critical' },
      ],
      onSubmenuSelect: (value: string) => {
        onUpdate({ priority: value });
        onClose();
      },
    },
    {
      label: 'Переместить в...',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12M8 12h12m-12 5h12M3 7h.01M3 12h.01M3 17h.01" />
        </svg>
      ),
      submenu: statuses.map(s => ({ label: s.name, value: s.id })),
      onSubmenuSelect: (value: number) => {
        onUpdate({ status_id: value });
        onClose();
      },
    },
    { divider: true },
    {
      label: 'Удалить',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      onClick: () => {
        if (confirm('Удалить задачу?')) {
          onDelete();
          onClose();
        }
      },
      danger: true,
    },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed bg-white border border-gray-200 rounded-md shadow-lg py-1 z-50 min-w-[200px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {menuItems.map((item, index) => {
        if (item.divider) {
          return <div key={index} className="my-1 border-t border-gray-200" />;
        }

        if (item.submenu) {
          return (
            <SubmenuItem
              key={index}
              item={item}
              onSelect={item.onSubmenuSelect}
            />
          );
        }

        return (
          <button
            key={index}
            onClick={item.onClick}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
              item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-900'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};

const SubmenuItem: React.FC<{ item: any; onSelect: (value: any) => void }> = ({ item, onSelect }) => {
  const [showSubmenu, setShowSubmenu] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowSubmenu(true)}
      onMouseLeave={() => setShowSubmenu(false)}
    >
      <button className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-gray-900 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2">
          {item.icon}
          <span>{item.label}</span>
        </div>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {showSubmenu && (
        <div className="absolute left-full top-0 ml-1 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[160px]">
          {item.submenu.map((subItem: any, idx: number) => (
            <button
              key={idx}
              onClick={() => onSelect(subItem.value)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-900 hover:bg-gray-50 transition-colors text-left"
            >
              {subItem.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

