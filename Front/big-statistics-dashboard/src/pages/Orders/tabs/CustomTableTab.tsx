import OrdersCustomTrainingOverlay from '../utils/CustomTableBuilder/OrdersCustomTrainingOverlay';
import CustomTableBuilder from '../utils/CustomTableBuilder/CustomTableBuilder';
import { Table } from '@tanstack/react-table';
import { RefObject } from 'react';

// Тип Order можно импортировать или определить здесь
// type Order = Record<string, any>;

interface CustomTableTabProps {
  data: Record<string, any>[];
  selectedKeys: string[];
  allColumns: string[];
  onToggle: (key: string) => void;
  onTableReady: (table: Table<Record<string, any>> | null) => void;
  t: any;
  anchorRef: RefObject<HTMLButtonElement | null>;
  customTable: Table<Record<string, any>> | null;
  setCustomTable: (table: Table<Record<string, any>> | null) => void;
}

export default function CustomTableTab({
  data,
  selectedKeys,
  allColumns,
  onToggle,
  onTableReady,
  t,
  anchorRef,
  customTable,
  setCustomTable,
}: CustomTableTabProps) {
  return (
    <>
      <OrdersCustomTrainingOverlay anchorRef={anchorRef} visible={selectedKeys.length === 0} />
      <CustomTableBuilder
        initialData={data}
        selectedKeys={selectedKeys}
        allColumns={allColumns}
        onToggle={onToggle}
        onTableReady={setCustomTable}
      />
    </>
  );
} 