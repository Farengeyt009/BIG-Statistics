import { useEffect, useState, useMemo, useRef } from "react";
import mockData from "../../Test/uncompleted_orders.json";
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
    ColumnDef,
    Table,
} from "@tanstack/react-table";
import { useTranslation } from 'react-i18next';
import CustomTableTab from './tabs/CustomTableTab';
import FieldsSelectorPopover from "./FieldsSelectorPopover";
import ExportButton from "../../components/ExportButton";
import Chart from './tabs/Chart';
import MainTableTab from './tabs/MainTableTab';

type Order = Record<string, any>;

const isMock = true;

export default function CustomerOrdersInformation() {
    const [data, setData] = useState<Order[]>([]);
    const [activeTab, setActiveTab] = useState("main");
    const { t } = useTranslation('ordersTranslation');

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

    // Новые состояния для кнопок
    const anchorRef = useRef<HTMLButtonElement>(null);
    const [customTable, setCustomTable] = useState<Table<Order> | null>(null);
    const [mainTable, setMainTable] = useState<Table<Order> | null>(null);

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

    return (
        <div className="p-4">
            {/* header-bar */}
            <header className="mb-4">
                <h1 className="text-2xl font-bold mb-2">{t('title')}</h1>
                {/* TAB STRIP */}
                <div className="flex items-end justify-between">
                    <ul className="flex gap-0.5 h-9">
                        {[
                            { label: t('mainTab'), key: 'main' },
                            { label: t('chartTab'), key: 'gantt' },
                            { label: t('customTab'), key: 'custom' },
                        ].map(tab => (
                            <li key={tab.key}>
                                <button
                                    onClick={() => setActiveTab(tab.key)}
                                    className={
                                        `px-4 h-8 flex items-center rounded-t-md text-sm select-none ` +
                                        (activeTab === tab.key
                                            ? 'bg-white text-gray-900 border border-b-transparent'
                                            : 'bg-gray-100 text-gray-500 hover:text-gray-800 border border-gray-300')
                                    }
                                >
                                    {tab.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                    {/* Кнопки действий – на Main и Custom */}
                    {activeTab === 'main' && (
                        <div className="flex gap-3">
                            <ExportButton
                                table={mainTable}
                                fileName="main_table.xlsx"
                            />
                        </div>
                    )}
                    {activeTab === 'custom' && (
                        <div className="flex gap-3">
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
                            <ExportButton
                                table={customTable}
                                fileName="uncompleted_orders.xlsx"
                            />
                        </div>
                    )}
                </div>
                {/* Серая «полка» сразу под табами  – ровно 1 px */}
                <div className="-mt-px h-px bg-gray-300" />
            </header>
            {/* Содержимое вкладок */}
            {activeTab === 'main'   && (
                <MainTableTab data={data} onTableReady={setMainTable} />
            )}
            {activeTab === 'gantt'  && (
                <Chart />
            )}
            {activeTab === 'custom' && (
                <CustomTableTab
                    data={data}
                    selectedKeys={selectedKeys}
                    allColumns={allColumns}
                    onToggle={handleToggle}
                    onTableReady={setCustomTable}
                    t={t}
                    anchorRef={anchorRef}
                    customTable={customTable}
                    setCustomTable={setCustomTable}
                />
            )}
        </div>
    );
}
