import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload, List } from 'lucide-react';
import SalePlanUploadModal from './SalePlanUploadModal';
import SalePlanVersionsModal from './SalePlanVersionsModal';
import SalePlanTable from './SalePlanTable';
import SalePlanTableByGroup from './SalePlanTableByGroup';
import FocusModeToggle from '../../../../components/focus/FocusModeToggle';

interface Props {
  selectedYear: number | null;
}

export default function Details({ selectedYear }: Props) {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isVersionsModalOpen, setIsVersionsModalOpen] = useState(false);

  // Кнопки действий
  const actions = (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setIsVersionsModalOpen(true)}
        className="h-8 w-8 p-2 rounded-md border border-gray-300 bg-white text-slate-700 hover:bg-gray-100 transition flex items-center justify-center"
        title="Manage Versions"
        aria-label="Manage Versions"
      >
        <List className="w-4 h-4" />
      </button>
      <button
        onClick={() => setIsUploadModalOpen(true)}
        className="h-8 w-8 p-2 rounded-md border border-gray-300 bg-white text-slate-700 hover:bg-gray-100 transition flex items-center justify-center"
        title="Upload Sale Plan"
        aria-label="Upload Sale Plan"
      >
        <Upload className="w-4 h-4" />
      </button>
      <FocusModeToggle variant="dark" />
    </div>
  );

  const actionsSlot = typeof document !== 'undefined' ? document.getElementById('saleplan-actions-slot') : null;

  return (
    <div className="flex flex-col">
      {/* Рендерим кнопки в слот или показываем локально */}
      {actionsSlot ? createPortal(actions, actionsSlot) : actions}

      {/* Первая таблица: группировка по Market */}
      <SalePlanTable selectedYear={selectedYear} />

      {/* Вторая таблица: группировка по LargeGroup */}
      <div className="mt-8">
        <SalePlanTableByGroup selectedYear={selectedYear} />
      </div>

      {/* Модальное окно загрузки */}
      <SalePlanUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={() => {
          console.log('Файл успешно загружен');
        }}
      />

      {/* Модальное окно управления версиями */}
      <SalePlanVersionsModal
        isOpen={isVersionsModalOpen}
        onClose={() => setIsVersionsModalOpen(false)}
      />
    </div>
  );
}

