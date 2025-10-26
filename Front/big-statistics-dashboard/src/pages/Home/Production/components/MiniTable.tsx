// src/pages/Home/Production/components/MiniTable.tsx
import React from 'react';
import { useAutoDashboard } from './AutoDashboard';

interface Props {
  /** Заголовок таблицы слева */
  title: string;
  /** Доп. заголовок справа (необязательный) */
  secondTitle?: string;
  /** Класс для позиционирования второго заголовка (необязательный) */
  secondTitlePosition?: string;
  /** Массив названий колонок */
  cols: string[];
  /** Массив строк (каждая строка — массив значений) */
  rows: (string | number)[][];
  /** Callback для hover событий (необязательный) */
  onRowHover?: (workShop: string, workCenter: string) => void;
  /** Callback для mouse leave (необязательный) */
  onRowLeave?: () => void;
  /** Callback для клика по строке (необязательный) */
  onRowClick?: (workShop: string, workCenter: string) => void;
  /** Закрепленная строка (необязательный) */
  pinnedWorkShop?: {workShop: string, workCenter: string} | null;
  /** Индекс активной строки для авторежима (необязательный) */
  activeRowIndex?: number | null;
}

export const MiniTable = ({ title, secondTitle, secondTitlePosition, cols, rows, onRowHover, onRowLeave, onRowClick, pinnedWorkShop, activeRowIndex }: Props) => {
  const { isAutoMode, currentRowIndex } = useAutoDashboard();
  
  // Используем activeRowIndex из пропсов или из авторежима
  const effectiveActiveRowIndex = activeRowIndex !== undefined ? activeRowIndex : (isAutoMode ? currentRowIndex : null);
  
  return (
  <div className="flex-1">
    {/* ── Заголовок ───────────────────────────────────────── */}
    <div className="px-6 pb-2 flex">
      <div className="flex items-center gap-2">
        <p className="font-semibold">{title}</p>
        {onRowClick && (
          <span className="text-xs text-gray-500 italic">
            (click to pin)
          </span>
        )}
      </div>

      {secondTitle && (
        <div className={`flex items-center ml-auto ${secondTitlePosition || 'mr-28'}`}>
          <p className="font-semibold">{secondTitle}</p>
        </div>
      )}
    </div>

    <table className="w-full text-sm">
      {/* ── Шапка ─────────────────────────────────────────── */}
      <thead className="hidden">
        <tr className="border-b border-gray-200">
          {cols.map((col, index) => (
            <th
              key={index}
              className={`py-2 font-medium text-gray-600 ${
                index === 0
                  ? 'pl-6 pr-3 text-left'
                  : index === 1
                  ? 'pl-6 pr-3 text-left'
                  : index === 2
                  ? cols.length === 6 
                    ? 'pl-6 pr-3 text-left'  // Name (Reason)
                    : 'text-right min-w-[60px] max-w-[80px]'  // Plan (WorkShop)
                  : index === 3
                  ? cols.length === 6 
                    ? 'text-right min-w-[60px] max-w-[80px]'  // Plan (Reason)
                    : 'pl-4 text-left'  // Fact (WorkShop)
                  : index === 4
                  ? 'pl-4 text-left'
                  : 'text-right min-w-[60px] max-w-[80px]'
              }`}
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>

      {/* ── Строки ────────────────────────────────────────── */}
      <tbody>
        {rows.map((row, i) => {
          const isWorkShopTable = cols.length === 5; // 5 колонок
          const isReasonTable   = cols.length === 6; // 6 колонок

          const completedIndex = isReasonTable ? 5 : 4;
          const completedVal   = Math.min(
            100,
            parseFloat(String(row[completedIndex])) || 0
          );

          // Проверяем, закреплена ли эта строка
          const isPinned = pinnedWorkShop && 
                          String(row[0]) === pinnedWorkShop.workShop && 
                          String(row[1]) === pinnedWorkShop.workCenter;

          return (
            <tr 
              key={i} 
              className={`hover:bg-gray-50 relative cursor-pointer ${
                effectiveActiveRowIndex === i ? 'bg-gray-50' : ''
              } ${isPinned ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
              onMouseEnter={() => {
                if (onRowHover && isWorkShopTable) {
                  onRowHover(String(row[0]), String(row[1])); // workShop, workCenter
                }
              }}
              onMouseLeave={() => {
                if (onRowLeave && isWorkShopTable) {
                  onRowLeave();
                }
              }}
              onClick={() => {
                if (onRowClick && isWorkShopTable) {
                  onRowClick(String(row[0]), String(row[1])); // workShop, workCenter
                }
              }}
            >
              {/* 1. Order No | WorkShop */}
              <td className="pl-6 pr-3 py-2">{row[0]}</td>

              {/* 2. Article Number */}
              <td className="pl-6 pr-3 py-2">{row[1]}</td>

              {/* 3. Name (Reason) | Plan (WorkShop) */}
              <td
                className={
                  isReasonTable
                    ? 'pl-6 pr-3 py-2 text-left' // как Article Number
                    : 'py-2 text-right font-medium min-w-[60px] max-w-[80px]'
                }
              >
                {row[2]}
              </td>

              {/* 4. Plan (Reason only) */}
              {isReasonTable && (
                <td className="py-2 text-right font-medium min-w-[60px] max-w-[80px]">
                  {row[3]}
                </td>
              )}

              {/* 5. Fact (Reason) | Name (WorkShop) */}
              {isReasonTable ? (
                <td className="py-2 pl-4 text-left">
                  {row[4]}
                </td>
              ) : (
                <td className="py-2 pl-4 text-left">{row[3]}</td>
              )}

              {/* 6. Compl. с прогресс‑фоном */}
              <td
                className="relative py-2 text-right text-gray-500 min-w-[60px] max-w-[80px]"
                style={{ width: '50px' }}
              >
                {/* вертикальная граница */}
                <span className="absolute inset-y-0 left-0 border-l border-gray-400" />

                {/* фон‑прогресс */}
                <span
                  className="absolute inset-y-1 left-0 bg-blue-200/60"
                  style={{ width: `${completedVal}%` }}
                />

                {/* текст поверх фона */}
                <span className="relative z-10 pl-2">
                  {row[completedIndex]}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
  );
};
