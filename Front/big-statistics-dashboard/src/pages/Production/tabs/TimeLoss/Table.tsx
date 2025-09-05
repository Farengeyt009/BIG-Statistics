import React from 'react';
import TimeLossTable from './TimeLossTable';

interface TableProps {
  date?: string;            // поддержка прошлого API (один день)
  startDate?: string;       // новый параметр: начало диапазона (YYYY-MM-DD)
  endDate?: string;         // новый параметр: конец диапазона (YYYY-MM-DD)
  selectedWorkShopIds?: string[]; // фильтр по цехам (по ID)
}

const Table: React.FC<TableProps> = ({ date, startDate, endDate, selectedWorkShopIds }) => {
  // Если пришел диапазон — передаем его в таблицу; иначе используем одну дату
  const currentDate = date || new Date().toISOString().split('T')[0];

  return (
    <div>
      <TimeLossTable date={currentDate} startDate={startDate} endDate={endDate} initialWorkShop={undefined} selectedWorkShopIds={selectedWorkShopIds} />
    </div>
  );
};

export default Table;
