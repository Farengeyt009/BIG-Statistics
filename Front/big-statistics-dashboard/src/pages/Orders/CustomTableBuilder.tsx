import {
    useState,
    useEffect,
    useMemo,
    forwardRef,
  } from 'react';
  import { ColumnDef, Table } from '@tanstack/react-table';
  import { useTranslation } from 'react-i18next';
  
  import { groupAndAggregate } from './utils/groupAndAggregate';
  import { DataTable } from '../../components/DataTable/DataTable';
  
  type Order = Record<string, any>;
  
  type Props = {
    initialData?: Order[];
    selectedKeys: string[];
    allColumns: string[];
    onToggle: (key: string) => void;
    onTableReady?: (table: Table<Order>) => void;
  };
  
  export type CustomTableHandle<T = any> = {
    table: any;
  };
  
  const CustomTableBuilder = forwardRef<CustomTableHandle<Order>, Props>(
    (
      { initialData = [], selectedKeys, allColumns, onToggle, onTableReady },
      ref,
    ) => {
      const [uncompletedOrders, setUncompletedOrders] = useState<Order[]>([]);
      const { t } = useTranslation('ordersTranslation');
  
      /* ---------------------- fetch / init ---------------------- */
      useEffect(() => {
        const init = async () => {
          if (initialData.length) {
            setUncompletedOrders(initialData);
            return;
          }
          const res = await fetch('/api/uncompleted-orders/table');
          const data = await res.json();
          setUncompletedOrders(data);
        };
        init();
      }, [initialData]);
  
      /* ----------------- prepare displayed data ----------------- */
      const displayedData = useMemo(() => {
        if (selectedKeys.length === 0) return [];
  
        const sliced = uncompletedOrders.map((row) => {
          const subset: Record<string, any> = {};
          for (const key of selectedKeys) subset[key] = row[key];
          return subset;
        });
  
        return groupAndAggregate(sliced, selectedKeys);
      }, [uncompletedOrders, selectedKeys]);
  
      /* -------------- column overrides with meta ---------------- */
      const columnsOverrides = useMemo(() => {
        const overrides: Record<string, Partial<ColumnDef<Order>>> = {};
  
        selectedKeys.forEach((key) => {
          const label = t(`tableHeaders.${key}`, { defaultValue: key });
          overrides[key] = {
            header: label,                 // строка для UI-шапки
            meta: { excelHeader: label },  // строка для экспорта
          };
        });
  
        return overrides;
      }, [selectedKeys, t]);
  
      /* -------------------------- UI ---------------------------- */
      return (
        <div className="p-4">
          {selectedKeys.length > 0 && (
            <DataTable
              data={displayedData}
              columnsOverrides={columnsOverrides}
              defaultVisible={selectedKeys}
              onTableReady={onTableReady}
            />
          )}
        </div>
      );
    },
  );
  
  export default CustomTableBuilder;
  