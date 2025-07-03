import React from 'react';
import { DataTable } from '../../../components/DataTable/DataTable';

// Порядок отображения колонок в таблице
const columnsOrder = [
  'OrderDate',
  'OrderConformDay',
  'RunOrderDay',
  'OrderShipmentDay_Svod',
  'Market',
  'Prod_Group',
  'Order_No',
  'Article_number',
  'Name_CN',
  'Order_QTY',
  'FACT_QTY',
  'Uncompleted_QTY',
  'Delay',
];

// Переопределения заголовков колонок
const columnsOverrides = {
  OrderDate: { header: 'Order Date' },
  OrderConformDay: { header: 'Confirm Date' },
  RunOrderDay: { header: 'Run Day' },
  OrderShipmentDay_Svod: { header: 'Ship Date' },
  Market: { header: 'Market' },
  Prod_Group: { header: 'Prod Group' },
  Order_No: { header: 'Order No.' },
  Article_number: { header: 'Article No.' },
  Name_CN: { header: 'Prod. Name' },
  Order_QTY: { header: 'Order Qty' },
  FACT_QTY: { header: 'Done Qty' },
  Uncompleted_QTY: { header: 'Uncomp. Qty' },
  Delay: { header: 'Delay' },
};

interface MainTableTabProps {
  data: any[];
}

/**
 * Рендерит главную таблицу с уменьшенным масштабом содержимого (95 %).
 * Зачем именно «zoom»: в DataTable ячейки стилизованы через классы Tailwind
 * с фиксированными rem‑значениями (text-sm, text-xs). Проценты для
 * font-size на wrapper не влияют на rem, поэтому применяем zoom.
 *
 * Chrome, Edge и Safari поддерживают zoom; в Firefox добавлен fallback
 * через transform:scale.
 */
const MainTableTab: React.FC<MainTableTabProps> = ({ data }) => (
  <div
    style={{
      zoom: 0.98,
      // Fallback для браузеров без zoom (например, старый Firefox)
      transform: 'scale(1)',
      transformOrigin: 'top left',
      width: '105%',
      height: '105%',
    }}
  >
    <DataTable
      data={data}
      columnsOverrides={columnsOverrides}
      columnsOrder={columnsOrder}
    />
  </div>
);

export default MainTableTab;
