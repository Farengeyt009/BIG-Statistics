// src/components/DateRangePickerPro.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  addDays,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
} from "date-fns";
import {
  DateRange,
  Calendar,
  DefinedRange,
  Range,
  RangeKeyDict,
  createStaticRanges,
} from "react-date-range";
import { enUS, ru, zhCN } from "date-fns/locale";
import { CalendarPlus } from "lucide-react";
import { useTranslation } from 'react-i18next';
import dateRangePickerTranslations from './dateRangePickerTranslation.json';

import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

/* ───── helpers ───── */
const toUtcMidnight = (d: Date) =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

/* ───── locales ───── */
type Lang = "en" | "ru" | "zh";
const LOCALES: Record<Lang, Locale> = { en: enUS, ru, zh: zhCN };

/* ───── props ───── */
type Mode = "range" | "single";

export interface DateRangePickerProProps {
  mode?: Mode;
  startDate: Date | null;
  endDate?: Date | null;
  onApply: (from: Date, to?: Date) => void;
  onCancel?: () => void;
  locale?: Lang;
  minDate?: Date;
  maxDate?: Date;
  placeholder?: string;
  className?: string;
  position?: "left" | "right";
}

/* ───── sidebar presets (range-mode) ───── */
const createStaticRangesWithTranslation = (locale: Lang) => {
  const translations = dateRangePickerTranslations[locale] || dateRangePickerTranslations.en;
  
  return createStaticRanges([
    {
      label: translations.today,
      range: () => {
        const t = startOfDay(new Date());
        return { startDate: t, endDate: t };
      },
    },
    {
      label: translations.yesterday,
      range: () => {
        const y = startOfDay(addDays(new Date(), -1));
        return { startDate: y, endDate: y };
      },
    },
    {
      label: translations.last7days,
      range: () => ({
        startDate: startOfDay(addDays(new Date(), -6)),
        endDate: startOfDay(new Date()),
      }),
    },
    {
      label: translations.last30days,
      range: () => ({
        startDate: startOfDay(addDays(new Date(), -29)),
        endDate: startOfDay(new Date()),
      }),
    },
    {
      label: translations.thisMonth,
      range: () => ({
        startDate: startOfMonth(new Date()),
        endDate: startOfDay(new Date()),
      }),
    },
    {
      label: translations.lastMonth,
      range: () => {
        const prev = addDays(startOfMonth(new Date()), -1);
        return { startDate: startOfMonth(prev), endDate: endOfMonth(prev) };
      },
    },
  ]);
};

/* ───── component ───── */
export const DateRangePickerPro: React.FC<DateRangePickerProProps> = ({
  mode = "range",
  startDate,
  endDate,
  onApply,
  onCancel,
  locale = "en",
  minDate = new Date(2025, 0, 1),
  maxDate = new Date(),
  placeholder,
  className = "",
  position = "left",
}) => {
  // Получаем переводы
  const translations = dateRangePickerTranslations[locale] || dateRangePickerTranslations.en;
  const staticRanges = createStaticRangesWithTranslation(locale);
  const defaultPlaceholder = placeholder || translations.selectDate;
  /* state */
  const [isOpen, setIsOpen] = useState(false);

  const [range, setRange] = useState<Range[]>([
    {
      startDate: startDate ?? startOfDay(new Date()),
      endDate: mode === "range" ? endDate ?? startOfDay(new Date()) : undefined,
      key: "selection",
    },
  ]);

  const wrapperRef = useRef<HTMLDivElement>(null);

  /* click-outside */
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setIsOpen(false);
    };
    if (isOpen) document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [isOpen]);

  /* display string */
  const display =
    mode === "range"
      ? range[0].startDate && range[0].endDate
        ? `${format(range[0].startDate, "dd.MM.yyyy")} 〜 ${format(
            range[0].endDate,
            "dd.MM.yyyy",
          )}`
        : defaultPlaceholder
      : range[0].startDate
      ? format(range[0].startDate, "MM.yyyy")
      : defaultPlaceholder;

  /* handlers */
  const handleRangeSelect = (r: RangeKeyDict) =>
    setRange([{ ...r.selection, key: "selection" }]);

  const handleSingleSelect = (d: Date) =>
    setRange([{ startDate: d, endDate: undefined, key: "selection" }]);

  const handleApply = () => {
    const { startDate: from, endDate: to } = range[0];
    if (!from) return;

    // ⬇ конвертируем в полночь UTC только перед отправкой наружу
    const fromUtc = toUtcMidnight(from);
    const toUtc = mode === "range" && to ? toUtcMidnight(to) : undefined;

    onApply(fromUtc, toUtc);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setRange([
      {
        startDate: startDate ?? startOfDay(new Date()),
        endDate:
          mode === "range" ? endDate ?? startOfDay(new Date()) : undefined,
        key: "selection",
      },
    ]);
    setIsOpen(false);
    onCancel?.();
  };

  /* render */
  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {/* trigger */}
      <div
        onClick={() => setIsOpen((o) => !o)}
        className="relative w-full cursor-pointer"
      >
        <CalendarPlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0d1c3d]" />
        <input
          readOnly
          value={display}
          placeholder={defaultPlaceholder}
          className="w-full rounded-md border border-[#0d1c3d] bg-white px-8 py-2 text-sm focus:border-[#0d1c3d] focus:ring-1 focus:ring-[#0d1c3d]"
        />
      </div>

      {isOpen && (
        <div
          className={`absolute top-full z-50 mt-1 ${
            position === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="w-fit rounded-lg border bg-white p-4 shadow-lg">
            <div className="flex gap-4">
              {mode === "range" && (
                <DefinedRange
                  inputRanges={[]}
                  staticRanges={staticRanges}
                  ranges={range}
                  onChange={(r) =>
                    setRange([{ ...r.selection, key: "selection" }])
                  }
                />
              )}

              {mode === "range" ? (
                <DateRange
                  ranges={range}
                  onChange={handleRangeSelect}
                  months={2}
                  direction="horizontal"
                  locale={LOCALES[locale]}
                  minDate={minDate}
                  maxDate={maxDate}
                  showMonthAndYearPickers
                  moveRangeOnFirstSelection={false}
                  rangeColors={["#6366F1"]}
                  showDateDisplay={false}
                />
              ) : (
                <Calendar
                  date={range[0].startDate}
                  onChange={handleSingleSelect}
                  locale={LOCALES[locale]}
                  minDate={minDate}
                  maxDate={maxDate}
                  showMonthAndYearPickers
                  months={1}
                />
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={handleCancel}
                className="rounded-md border px-4 py-2 text-sm"
              >
                {translations.cancel}
              </button>
              <button
                onClick={handleApply}
                className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white"
              >
                {translations.apply}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
