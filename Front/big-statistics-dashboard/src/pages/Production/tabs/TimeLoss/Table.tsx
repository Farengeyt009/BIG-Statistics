import React from 'react';
import TimeLossTable from './TimeLossTable';

interface TableProps {
  date?: string;            // поддержка прошлого API (один день)
  startDate?: string;       // новый параметр: начало диапазона (YYYY-MM-DD)
  endDate?: string;         // новый параметр: конец диапазона (YYYY-MM-DD)
  selectedWorkShopIds?: string[]; // фильтр по цехам (по ID)
  suppressLocalLoaders?: boolean;
  onLoadingChange?: (loading: boolean) => void;
  isActive?: boolean;
  canEditFull?: boolean;    // Полные права на редактирование
  canEditLimited?: boolean; // Ограниченные права (только ActionPlan, Responsible, CompletedDate)
}

const Table: React.FC<TableProps> = ({ date, startDate, endDate, selectedWorkShopIds, suppressLocalLoaders, onLoadingChange, isActive, canEditFull, canEditLimited }) => {
  // Если пришел диапазон — передаем его в таблицу; иначе используем одну дату
  const currentDate = date || new Date().toISOString().split('T')[0];

  return (
    <div>
      <TimeLossTable 
        date={currentDate} 
        startDate={startDate} 
        endDate={endDate} 
        initialWorkShop={undefined} 
        selectedWorkShopIds={selectedWorkShopIds} 
        suppressLocalLoaders={suppressLocalLoaders} 
        onLoadingChange={onLoadingChange} 
        isActive={isActive}
        canEditFull={canEditFull}
        canEditLimited={canEditLimited}
      />
    </div>
  );
};

export default Table;
