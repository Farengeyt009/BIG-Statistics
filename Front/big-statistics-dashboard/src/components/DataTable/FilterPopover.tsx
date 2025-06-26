import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from 'react-i18next';

interface FilterPopoverProps {
  columnId: string;
  data: any[];
  uniqueValues: string[];
  selectedValues: string[];
  onFilterChange: (selected: string[]) => void;
}

const FilterPopover: React.FC<FilterPopoverProps> = ({ columnId, uniqueValues, selectedValues, onFilterChange }) => {
  const { t } = useTranslation('dataTable');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<string[]>(selectedValues);

  // Определяем состояние чекбокса "Выбрать все"
  const allSelected = selectedValues.length === uniqueValues.length;
  const noneSelected = selectedValues.length === 0;
  const someSelected = !allSelected && !noneSelected;

  useEffect(() => {
    if (open) {
      setDraft(selectedValues.length === 0 ? [...uniqueValues] : selectedValues);
    }
  }, [open, selectedValues, uniqueValues]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = draft.length > 0 && draft.length < uniqueValues.length;
    }
  }, [draft, uniqueValues]);

  const filteredValues = uniqueValues.filter(val =>
    search ? val.toLowerCase().includes(search.toLowerCase()) : true
  );

  return (
    <div className="relative inline-block">
      <button
        className={`text-gray-400 hover:text-blue-600 ${selectedValues.length ? 'text-blue-600' : ''} relative`}
        onPointerDown={e => e.stopPropagation()}
        onClick={e => {
          e.stopPropagation();
          setOpen(o => !o);
        }}
        tabIndex={-1}
      >
        {/* SVG фильтра: увеличен размер и длина */}
        <svg width="18" height="18" fill="none" viewBox="0 0 28 28">
          <path stroke="currentColor" strokeWidth="2" d="M4 7h20M8 14h12m-6 7h.01"/>
        </svg>
        {/* Индикатор фильтрации */}
        {selectedValues.length > 0 && (
          <span className="absolute top-0 right-0 block w-2 h-2 bg-blue-500 rounded-full border border-white"></span>
        )}
      </button>
      {open && (
        <div
          ref={popoverRef}
          className="absolute top-0 left-0 z-50 bg-white border rounded shadow-lg p-4 min-w-[180px]"
          onPointerDown={e => e.stopPropagation()}
        >
          <div className="flex flex-col">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="mb-2 w-full border rounded px-2 py-1 text-xs"
              placeholder={t('search')}
              autoFocus
            />
            {/* Select All */}
            <label className="flex items-center gap-2 text-sm cursor-pointer mb-1">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={draft.length === uniqueValues.length}
                onChange={() =>
                  setDraft(draft.length === uniqueValues.length ? [] : [...uniqueValues])
                }
              />
              <span className="font-medium">{t('selectAll')}</span>
            </label>
            {/* Список значений — только он скроллируется */}
            <div className="overflow-y-auto max-h-40 pr-1 mt-1">
              {filteredValues.map(val => (
                <label key={val} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.includes(val)}
                    onChange={e => {
                      if (e.target.checked) {
                        setDraft([...draft, val]);
                      } else {
                        const next = draft.filter(v => v !== val);
                        setDraft(next.length === uniqueValues.length ? [] : next);
                      }
                    }}
                  />
                  <span>{val === '' ? <span className="italic text-gray-400">(empty)</span> : val}</span>
                </label>
              ))}
            </div>
            {/* Кнопки OK/Cancel фиксированы внизу */}
            <div className="flex justify-end gap-2 mt-3 text-xs shrink-0">
              <button
                className="px-3 py-1 border rounded hover:bg-gray-100"
                onClick={() => setOpen(false)}
              >
                {t('cancel', { defaultValue: 'Cancel' })}
              </button>
              <button
                className="px-3 py-1 border rounded bg-blue-600 text-white disabled:bg-gray-300"
                disabled={draft.length === 0}
                onClick={() => {
                  onFilterChange(draft.length === uniqueValues.length ? [] : draft);
                  setOpen(false);
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(FilterPopover); 