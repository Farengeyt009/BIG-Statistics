import React from 'react';
import { useTranslation } from 'react-i18next';
import GroupedProductionTable from './GroupedProductionTable';
import GroupedProductionTableByGroup from './GroupedProductionTableByGroup';

// SVG компонент для стрелки
const ArrowIcon: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'inline-block', verticalAlign: 'middle', margin: '0 4px' }}
  >
    <path
      d="M6 4L10 8L6 12"
      stroke="#6b7280"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const OrdersStatistics: React.FC = () => {
  const { t } = useTranslation('ordersTranslation');
  
  return (
    <div className="p-2">
      {/* Первая таблица с группировкой по рынку */}
      <GroupedProductionTable />
      
      {/* Вторая таблица с группировкой по группе (без рынка) */}
      <div className="mt-8">
        <GroupedProductionTableByGroup />
      </div>
      
      {/* Здесь можно добавить другие таблицы и графики */}
    </div>
  );
};

export default OrdersStatistics;

