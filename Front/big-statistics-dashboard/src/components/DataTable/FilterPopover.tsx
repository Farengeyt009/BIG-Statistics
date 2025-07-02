import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  useFloating,
  offset,
  shift,
  autoUpdate,
} from '@floating-ui/react';

interface FilterPopoverProps {
  columnId: string;
  data: any[];
  uniqueValues: string[];
  selectedValues: string[];
  onFilterChange: (selected: string[]) => void;
}

const FilterPopover: React.FC<FilterPopoverProps> = ({
  columnId,
  uniqueValues,
  selectedValues,
  onFilterChange,
}) => {
  const { t } = useTranslation('dataTable');

  /* --------------------- local state --------------------- */
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<string[]>(selectedValues);

  /* ---------------- refs & floating-ui ------------------- */
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const { refs, floatingStyles, update } = useFloating({
    placement: 'bottom-start',
    middleware: [offset(4), shift()],
    whileElementsMounted: autoUpdate,
  });

  /* привязываем reference-элемент */
  useEffect(() => {
    refs.setReference(buttonRef.current);
  }, [refs]);

  /* синхронизация draft при открытии */
  useEffect(() => {
    if (open) {
      setDraft(selectedValues.length === 0 ? [...uniqueValues] : selectedValues);
      update(); // сразу позиционируем
    }
  }, [open, selectedValues, uniqueValues, update]);

  /* indeterminate для «Select All» */
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        draft.length > 0 && draft.length < uniqueValues.length;
    }
  }, [draft, uniqueValues]);

  /* ------------- авто-закрытие по клику «вне» ------------- */
  useEffect(() => {
    if (!open) return;

    const handleOutside = (e: PointerEvent) => {
      const pop = refs.floating.current;
      const btn = buttonRef.current;

      if (btn && btn.contains(e.target as Node)) return;
      if (pop && pop.contains(e.target as Node)) return;

      setOpen(false);               // эквивалент Cancel
    };

    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [open, refs.floating]);

  /* ------------------- helpers ------------------- */
  const filteredValues = uniqueValues.filter((v) =>
    search ? v.toLowerCase().includes(search.toLowerCase()) : true,
  );

  /* -------------------- render ------------------- */
  return (
    <div className="relative inline-block">
      {/* trigger */} 
      <button
        ref={buttonRef}
        className={`text-gray-400 hover:text-blue-600 ${
          selectedValues.length ? 'text-blue-600' : ''
        } relative`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        tabIndex={-1}
      >
        <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
          <path stroke="currentColor" strokeWidth="2" d="M4 7h20M8 14h12m-6 7h.01" />
        </svg>
        {selectedValues.length > 0 && (
          <span className="absolute top-0 right-0 block w-2 h-2 bg-blue-500 rounded-full border border-white" />
        )}
      </button>

      {/* popover */}
      {open &&
        createPortal(
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="z-[9999] bg-white border rounded shadow-lg p-4 min-w-[180px]"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* поиск */}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
                  setDraft(
                    draft.length === uniqueValues.length ? [] : [...uniqueValues],
                  )
                }
              />
              <span className="font-medium">{t('selectAll')}</span>
            </label>

            {/* значения */}
            <div className="overflow-y-auto max-h-40 pr-1 mt-1">
              {filteredValues.map((val) => (
                <label
                  key={val}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={draft.includes(val)}
                    onChange={(e) => {
                      if (e.target.checked) setDraft([...draft, val]);
                      else {
                        const next = draft.filter((v) => v !== val);
                        setDraft(next.length === uniqueValues.length ? [] : next);
                      }
                    }}
                  />
                  <span>
                    {val === '' ? (
                      <span className="italic text-gray-400">(empty)</span>
                    ) : (
                      val
                    )}
                  </span>
                </label>
              ))}
            </div>

            {/* OK / Cancel */}
            <div className="flex justify-end gap-2 mt-3 text-xs">
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
                  onFilterChange(
                    draft.length === uniqueValues.length ? [] : draft,
                  );
                  setOpen(false);
                }}
              >
                OK
              </button>
            </div>
          </div>,
          /* куда телепортируем pop-up */
          (() => {
            const root =
              document.getElementById('portal-root') ??
              (() => {
                const el = document.createElement('div');
                el.id = 'portal-root';
                document.body.appendChild(el);
                return el;
              })();
            return root;
          })(),
        )}
    </div>
  );
};

export default React.memo(FilterPopover);
