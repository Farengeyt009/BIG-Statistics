import React from 'react';
import TimeLossTable from './TimeLossTable';

interface TableProps {
  date?: string;
}

const Table: React.FC<TableProps> = ({ date }) => {
  // Используем переданную дату или текущую дату по умолчанию
  const currentDate = date || new Date().toISOString().split('T')[0];

  return (
    <div>
      <TimeLossTable date={currentDate} />
    </div>
  );
};

export default Table;
