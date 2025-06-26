import { useState, useEffect, useRef } from "react";
import { FIELD_GROUPS } from "./fieldGroups";

interface FieldsSelectorPopoverProps {
    allColumns: string[];
    selectedKeys: string[];
    onToggle: (key: string) => void;
    t: any;
    anchorRef?: React.RefObject<HTMLButtonElement | null>;
    buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}

const FieldsSelectorPopover: React.FC<FieldsSelectorPopoverProps> = ({
    allColumns,
    selectedKeys,
    onToggle,
    t,
    anchorRef,
    buttonProps
}) => {
    const [open, setOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    // Закрытие popover при клике вне
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (!open) return;
            if (
                popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
                anchorRef && anchorRef.current && !anchorRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        }
        if (open) {
            document.addEventListener('mousedown', handleClick);
            return () => document.removeEventListener('mousedown', handleClick);
        }
    }, [open, anchorRef]);

    // Группировка полей
    const grouped: Record<string, string[]> = {};
    const used = new Set<string>();
    Object.entries(FIELD_GROUPS).forEach(([group, fields]) => {
        const present = fields.filter(f => allColumns.includes(f));
        grouped[group] = present;
        present.forEach(f => used.add(f));
    });
    // Неопределённые
    grouped['uncategorized'] = allColumns.filter(f => !used.has(f));

    // Маппинг ключей групп на переводы
    const groupLabels: Record<string, string> = {
        'Информация о заказе': t('fieldGroups.orderInfo'),
        'Информация о продукте': t('fieldGroups.productInfo'),
        'Кол-во': t('fieldGroups.quantity'),
        'uncategorized': t('fieldGroups.uncategorized'),
    };

    return (
        <div className="relative inline-block">
            <button
                ref={anchorRef}
                className={
                    "h-8 px-3 text-sm bg-blue-600 text-white rounded-md shadow self-end hover:bg-blue-700 transition " +
                    (buttonProps?.className || "")
                }
                {...buttonProps}
                onClick={e => {
                    setOpen(o => !o);
                    buttonProps?.onClick?.(e);
                }}
            >
                {t('create', { defaultValue: 'Create' })} +
            </button>
            {open && (
                <div
                    ref={popoverRef}
                    className="absolute top-0 right-0 left-auto z-50 bg-white border rounded shadow-lg p-6 min-w-[700px] max-h-[500px] overflow-auto"
                >
                    <div className="grid grid-cols-4 gap-6">
                        {Object.entries(grouped).map(([group, fields]) => (
                            <div key={group}>
                                <div className="font-bold text-base text-gray-800 mb-3">{groupLabels[group] || group}</div>
                                <div className="flex flex-col gap-2">
                                    {fields.length > 0 ? fields.map((col) => (
                                        <label key={col} className="flex items-center gap-2 text-sm cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedKeys.includes(col)}
                                                onChange={() => onToggle(col)}
                                            />
                                            {t(`tableHeaders.${col}`, { defaultValue: col })}
                                        </label>
                                    )) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FieldsSelectorPopover; 