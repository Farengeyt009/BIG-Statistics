import React, { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { CalendarPlus } from 'lucide-react';
import { enUS, ru, zhCN } from 'date-fns/locale';
import dateRangePickerTranslations from './dateRangePickerTranslation.json';

type Lang = 'en' | 'ru' | 'zh';

export interface YearMonthRangePickerProps {
  from?: Date | null;
  to?: Date | null;
  onApply: (from: Date, to: Date) => void;
  onCancel?: () => void;
  locale?: Lang;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
  position?: 'left' | 'right';
  selectionMode?: 'range' | 'single';
}

const YearMonthRangePicker: React.FC<YearMonthRangePickerProps> = ({
  from,
  to,
  onApply,
  onCancel,
  locale = 'en',
  minDate = new Date(2025, 0, 1),
  maxDate = new Date(new Date().getFullYear() + 1, 11, 31),
  className = '',
  position = 'right',
  selectionMode = 'range',
}) => {
  const translations = dateRangePickerTranslations[locale] || dateRangePickerTranslations.en;

  const [isOpen, setIsOpen] = useState(false);
  const [year, setYear] = useState<number>((from ?? new Date()).getFullYear());
  const [fromYear, setFromYear] = useState<number | null>(from ? from.getFullYear() : null);
  const [fromMonth, setFromMonth] = useState<number | null>(from ? from.getMonth() : null);
  const [toYear, setToYear] = useState<number | null>(to ? to.getFullYear() : null);
  const [toMonth, setToMonth] = useState<number | null>(to ? to.getMonth() : null);
  const [hoverYear, setHoverYear] = useState<number | null>(null);
  const [hoverMonth, setHoverMonth] = useState<number | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [isOpen]);

  useEffect(() => {
    if (from) {
      setYear(from.getFullYear());
      setFromYear(from.getFullYear());
      setFromMonth(from.getMonth());
    }
    if (to) {
      setToYear(to.getFullYear());
      setToMonth(to.getMonth());
    }
  }, [from, to]);

  const years: number[] = [];
  for (let y = minDate.getFullYear(); y <= maxDate.getFullYear(); y++) years.push(y);

  const monthLabel = (m: number) =>
    locale === 'ru'
      ? ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][m]
      : locale === 'zh'
      ? [`1月`,`2月`,`3月`,`4月`,`5月`,`6月`,`7月`,`8月`,`9月`,`10月`,`11月`,`12月`][m]
      : ['January','February','March','April','May','June','July','August','September','October','November','December'][m];

  const serial = (y: number, m: number) => y * 12 + m;

  const onClickMonth = (m: number) => {
    // Single-month selection: just set from==to to selected month
    if (selectionMode === 'single') {
      setFromYear(year);
      setFromMonth(m);
      setToYear(year);
      setToMonth(m);
      return;
    }
    if (fromMonth === null || (fromMonth !== null && toMonth !== null)) {
      setFromYear(year);
      setFromMonth(m);
      setToYear(null);
      setToMonth(null);
      return;
    }
    if (fromMonth !== null && toMonth === null && fromYear !== null) {
      const fromS = serial(fromYear, fromMonth);
      const curS = serial(year, m);
      if (curS < fromS) {
        setToYear(fromYear);
        setToMonth(fromMonth);
        setFromYear(year);
        setFromMonth(m);
      } else {
        setToYear(year);
        setToMonth(m);
      }
      return;
    }
  };

  const isInRange = (m: number) => {
    if (selectionMode === 'single') {
      return (fromMonth === m && fromYear === year);
    }
    if (fromMonth === null || fromYear === null) return false;
    if (toMonth === null || toYear === null) {
      return year === fromYear && m === fromMonth;
    }
    const s = serial(year, m);
    const a = serial(fromYear, fromMonth);
    const b = serial(toYear, toMonth);
    return s >= Math.min(a, b) && s <= Math.max(a, b);
  };

  const isInHoverRange = (m: number) => {
    if (selectionMode === 'single') return false;
    if (fromMonth === null || fromYear === null || toMonth !== null || hoverMonth === null || hoverYear === null) return false;
    const s = serial(year, m);
    const a = serial(fromYear, fromMonth);
    const h = serial(hoverYear, hoverMonth);
    return s >= Math.min(a, h) && s <= Math.max(a, h);
  };

  const handleApply = () => {
    const fy = fromYear ?? year;
    const fm = fromMonth ?? 0;
    const ty = selectionMode === 'single' ? (fromYear ?? year) : (toYear ?? fromYear ?? year);
    const tm = selectionMode === 'single' ? (fromMonth ?? 0) : (toMonth ?? fromMonth ?? 0);
    const f = new Date(fy, fm, 1);
    const t = new Date(ty, tm, 1);
    onApply(f, t);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setIsOpen(false);
    onCancel?.();
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div onClick={() => setIsOpen((o) => !o)} className="relative w-full cursor-pointer max-w-[220px]">
        <CalendarPlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          readOnly
          value={(() => {
            const fmt = (d?: Date | null) => (d ? format(d, 'yyyy-MM') : '');
            const f = from ?? null;
            const t = to ?? null;
            if (f && t) {
              const same = f.getFullYear() === t.getFullYear() && f.getMonth() === t.getMonth();
              return same ? fmt(f) : `${fmt(f)} 〜 ${fmt(t)}`;
            }
            // show actual default based on current internal state when props not provided
            const fy = fromYear ?? year;
            const fm = fromMonth ?? 0;
            const ty = toYear ?? fromYear ?? year;
            const tm = toMonth ?? fromMonth ?? 0;
            const fDef = new Date(fy, fm, 1);
            const tDef = new Date(ty, tm, 1);
            const same2 = fDef.getFullYear() === tDef.getFullYear() && fDef.getMonth() === tDef.getMonth();
            return same2 ? format(fDef, 'yyyy-MM') : `${format(fDef, 'yyyy-MM')} 〜 ${format(tDef, 'yyyy-MM')}`;
          })()}
          placeholder={''}
          className="w-full rounded-md border border-gray-300 bg-white px-8 py-2 text-sm focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
        />
      </div>

      {isOpen && (
        <div className={`absolute top-full z-50 mt-1 ${position === 'right' ? 'right-0' : 'left-0'}`}>
          <div className="w-80 rounded-lg border bg-white p-3 shadow-lg">
            <div className="space-y-3">
              <div>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#0d1c3d] focus:ring-1 focus:ring-[#0d1c3d]"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-1">
                {Array.from({ length: 12 }).map((_, m) => (
                  <button
                    key={m}
                    onMouseEnter={() => { setHoverYear(year); setHoverMonth(m); }}
                    onMouseLeave={() => { setHoverYear(null); setHoverMonth(null); }}
                    onClick={() => onClickMonth(m)}
                    className={`px-2 py-1.5 text-xs rounded border transition-colors relative ${
                      isInRange(m)
                        ? 'bg-indigo-600/10 text-indigo-700 border-indigo-600'
                        : isInHoverRange(m)
                          ? 'bg-indigo-500/10 text-indigo-700 border-indigo-500'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-indigo-500'
                    }`}
                  >
                    <span className={`${(fromMonth === m && fromYear === year) || (toMonth === m && toYear === year) ? 'text-black' : ''}`}>{monthLabel(m)}</span>
                    {((fromMonth === m && fromYear === year) || (toMonth === m && toYear === year)) && (
                      <span className="absolute inset-0 rounded bg-indigo-600 -z-10"></span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={handleCancel} className="rounded-md border px-4 py-2 text-sm">
                {translations.cancel}
              </button>
              <button onClick={handleApply} className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white">
                {translations.apply}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default YearMonthRangePicker;


