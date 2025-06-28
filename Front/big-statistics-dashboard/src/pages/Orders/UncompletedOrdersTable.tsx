import { useEffect, useState, useRef, useMemo } from "react";
import CustomTableBuilder from "./CustomTableBuilder";
import FieldsSelectorPopover from "./FieldsSelectorPopover";
import mockData from "../../Test/uncompleted_orders.json";
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    ColumnDef,
    Table,
} from "@tanstack/react-table";
import { useTranslation } from 'react-i18next';
import ExportButton from "../../components/ExportButton";

type Order = Record<string, any>;

const isMock = true;

export default function UncompletedOrdersTable() {
    const [data, setData] = useState<Order[]>([]);
    const [activeTab, setActiveTab] = useState("main");
    const { t } = useTranslation('ordersTranslation');
    const anchorRef = useRef<HTMLButtonElement>(null);

    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
    const allColumns = useMemo(() => {
        const keySet = new Set<string>();
        data.forEach(row => Object.keys(row).forEach(key => keySet.add(key)));
        return Array.from(keySet);
    }, [data]);

    const handleToggle = (key: string) => {
        setSelectedKeys((prev) =>
            prev.includes(key)
                ? prev.filter((k) => k !== key)
                : [...prev, key]
        );
    };

    useEffect(() => {
        if (isMock) {
            const normalized = (mockData as any[]).map((row) => {
                const result = { ...row };
                result.Order_No = row.Order_No?.trim();
                return result;
            });
            setData(normalized);
        } else {
            fetch("/api/uncompleted-orders/table")
                .then((res) => res.json())
                .then((json) => setData(json.data));
        }
    }, []);

    const columns: ColumnDef<Order>[] = [
        {
            header: "Номер заказа",
            accessorKey: "Order_No",
        },
        {
            header: "Артикул",
            accessorKey: "Article_number",
        },
        {
            header: "Группа продукции",
            accessorKey: "Prod_Group",
        },
        {
            header: "Кол-во в заказе",
            accessorKey: "Order_QTY",
        },
        {
            header: "Невыполнено",
            accessorKey: "Uncompleted_QTY",
        },
    ];

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <div className="p-4">
            {/* header-bar */}
            <header className="mb-4">
                <h1 className="text-2xl font-bold mb-2">{t('title')}</h1>
                {/* TAB STRIP */}
                <div className="flex items-end justify-between">
                    <ul className="flex gap-0.5 h-9">
                        {[
                            { label: 'Main Table', key: 'main' },
                            { label: 'Gantt Chart', key: 'gantt' },
                            { label: 'Custom',     key: 'custom' },
                        ].map(tab => (
                            <li key={tab.key}>
                                <button
                                    onClick={() => setActiveTab(tab.key)}
                                    className={
                                        `px-4 h-8 flex items-center rounded-t-md text-sm select-none ` +
                                        (activeTab === tab.key
                                            ? 'bg-white text-gray-900 border border-b-transparent'
                                            : 'bg-gray-100 text-gray-500 hover:text-gray-800 border border-transparent')
                                    }
                                >
                                    {tab.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                    <div className="flex gap-3">
                        {/* Export всегда доступен */}
                        {table && (
                            <ExportButton
                                table={table as Table<Order>}
                                fileName="uncompleted_orders.xlsx"
                            />
                        )}
                        {/* Кнопка выбора столбцов – только на Custom */}
                        {activeTab === 'custom' && (
                            <FieldsSelectorPopover
                                allColumns={allColumns}
                                selectedKeys={selectedKeys}
                                onToggle={handleToggle}
                                t={t}
                                anchorRef={anchorRef}
                                buttonProps={{
                                    className: [
                                        'self-end',
                                        'bg-gradient-to-r',
                                        'from-blue-600 via-sky-500 to-cyan-400',
                                        'text-white font-semibold',
                                        'shadow-md shadow-sky-500/30',
                                        'hover:brightness-110',
                                        'active:scale-95',
                                        'transition-all duration-150',
                                        'rounded-lg',
                                        'h-8',
                                        'px-5',
                                        'text-sm'
                                    ].join(' ')
                                }}
                            />
                        )}
                    </div>
                </div>
                {/* Серая «полка» сразу под табами  – ровно 1 px */}
                <div className="-mt-px h-px bg-gray-300" />
            </header>
            {/* Содержимое вкладок */}
            {activeTab === 'main'   && (
                <table className="min-w-full border border-gray-300 text-sm">
                    <thead className="bg-gray-100">
                    {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <th key={header.id} className="border px-2 py-1 text-left">
                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                </th>
                            ))}
                        </tr>
                    ))}
                    </thead>
                    <tbody>
                    {table.getRowModel().rows.map((row) => (
                        <tr key={row.id}>
                            {row.getVisibleCells().map((cell) => (
                                <td key={cell.id} className="border px-2 py-1">
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                            ))}
                        </tr>
                    ))}
                    </tbody>
                </table>
            )}
            {activeTab === 'gantt'  && (
                <div className="text-gray-600 italic p-4 border rounded bg-gray-50">
                    📊 Gantt Chart (в разработке)
                </div>
            )}
            {activeTab === 'custom' && (
                <CustomTableBuilder
                    initialData={data}
                    selectedKeys={selectedKeys}
                    allColumns={allColumns}
                    onToggle={handleToggle}
                />
            )}
        </div>
    );
}
