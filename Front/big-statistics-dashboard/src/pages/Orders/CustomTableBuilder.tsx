import { useState, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from "react";
import { ColumnDef, Table, useReactTable, getCoreRowModel } from "@tanstack/react-table";
import { groupAndAggregate } from "./utils/groupAndAggregate";
import { NUMERIC_KEYS } from "./utils/numericFields";
import { useTranslation } from 'react-i18next';
import { DataTable } from "../../components/DataTable/DataTable";
import { FIELD_GROUPS } from "./fieldGroups";

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
    ({ initialData = [], selectedKeys, allColumns, onToggle, onTableReady }, ref) => {
        const [uncompletedOrders, setUncompletedOrders] = useState<Order[]>([]);
        const { t } = useTranslation('ordersTranslation');

        useEffect(() => {
            const init = async () => {
                let data = initialData;
                if (initialData.length === 0) {
                    const res = await fetch("/api/uncompleted-orders/table");
                    data = await res.json();
                }

                setUncompletedOrders(data);
            };

            init();
        }, [initialData]);

        // Подготовка данных для отображения
        const displayedData = useMemo(() => {
            if (selectedKeys.length === 0) return [];
            const selectedData = uncompletedOrders.map((row) => {
                const filteredRow: Record<string, any> = {};
                for (const key of selectedKeys) {
                    filteredRow[key] = row[key];
                }
                return filteredRow;
            });
            return groupAndAggregate(selectedData, selectedKeys);
        }, [uncompletedOrders, selectedKeys]);

        // Настройка колонок с переводами
        const columnsOverrides = useMemo(() => {
            const overrides: Record<string, Partial<ColumnDef<Order>>> = {};
            selectedKeys.forEach(key => {
                overrides[key] = {
                    header: t(`tableHeaders.${key}`, { defaultValue: key }),
                };
            });
            return overrides;
        }, [selectedKeys, t]);

        return (
            <div className="p-4">
                {/* Использование DataTable компонента */}
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
    }
);

export default CustomTableBuilder;
