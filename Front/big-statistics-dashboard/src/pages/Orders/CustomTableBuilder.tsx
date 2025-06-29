import { useState, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from "react";
import { ColumnDef, Table, useReactTable, getCoreRowModel } from "@tanstack/react-table";
import { groupAndAggregate } from "./utils/groupAndAggregate";
import { NUMERIC_KEYS } from "./utils/numericFields";
import { useTranslation } from 'react-i18next';
import { DataTable } from "../../components/DataTable/DataTable";
import { FIELD_GROUPS } from "./fieldGroups";

type Order = Record<string, any>;

export interface CustomTableHandle<T> { table: Table<T> }

interface Props {
    initialData: Order[];
    selectedKeys: string[];
    allColumns: string[];
    onToggle: (key: string) => void;
}

const CustomTableBuilder = forwardRef<CustomTableHandle<Order>, Props>(
    (props, ref) => {
        const { initialData, selectedKeys, allColumns, onToggle } = props;
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

        const columns = useMemo<ColumnDef<Order>[]>(() =>
            selectedKeys.map((key) => ({
                accessorKey: key,
                header: columnsOverrides[key]?.header ?? key,
                cell: info => info.getValue(),
                meta: { isNumeric: NUMERIC_KEYS.includes(key) },
            })), [selectedKeys, columnsOverrides]);

        const table = useReactTable({
            data: displayedData,
            columns,
            getCoreRowModel: getCoreRowModel(),
        });
        useImperativeHandle(ref, () => ({ table }), [table]);

        return (
            <div className="p-4">
                {selectedKeys.length > 0 && (
                    <DataTable
                        table={table}
                        defaultVisible={selectedKeys}
                    />
                )}
            </div>
        );
    }
);

export default CustomTableBuilder;
