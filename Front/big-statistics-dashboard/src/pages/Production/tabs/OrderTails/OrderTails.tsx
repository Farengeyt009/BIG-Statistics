import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import OrderTailsStatsGrid from './OrderTailsStatsGrid';
import OrderTailsTable from './OrderTailsTable';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
import { apiGetOrderTails, type OrderTailRow } from '../../../../config/timeloss-api';

const Stats: React.FC<{ rows?: OrderTailRow[]; suppressLocalLoaders?: boolean; onLoadingChange?: (l: boolean)=>void }> = (props) => <OrderTailsStatsGrid {...props} />;

const TableView: React.FC<{ rows?: OrderTailRow[]; suppressLocalLoaders?: boolean; onLoadingChange?: (l: boolean)=>void }> = (props) => <OrderTailsTable {...props} />;

const OrderTails: React.FC = () => {
  const { t } = useTranslation('production');
  const [tab, setTab] = useState<'stats' | 'table'>('stats');
  const [activeOnly, setActiveOnly] = useState<boolean>(false);
  // Используем счётчик активных загрузок, чтобы не прятать оверлей раньше времени
  const [pendingLoads, setPendingLoads] = useState<number>(0);
  const isLoading = pendingLoads > 0;
  const handleLoadingChange = (l: boolean) => setPendingLoads((c) => Math.max(0, c + (l ? 1 : -1)));

  // Кэшируем данные один раз при открытии вкладки
  const [rowsCache, setRowsCache] = useState<OrderTailRow[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      handleLoadingChange(true);
      try {
        const data = await apiGetOrderTails();
        if (!cancelled) setRowsCache(data || []);
      } finally {
        handleLoadingChange(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="p-4 relative min-h-[70vh]">
      {isLoading && (
        <LoadingSpinner overlay size="xl" />
      )}

      <div className="flex items-center gap-2 mb-4">
        <button
          className={`px-4 py-1 rounded-md text-sm font-medium border transition-colors ${tab === 'stats' ? 'bg-[#0d1c3d] text-white border-[#0d1c3d]' : 'bg-gray-100 text-gray-700 border-gray-300'}`}
          onClick={() => setTab('stats')}
        >
          {t('orderTailsTabs.stats')}
        </button>
        <button
          className={`px-4 py-1 rounded-md text-sm font-medium border transition-colors ${tab === 'table' ? 'bg-[#0d1c3d] text-white border-[#0d1c3d]' : 'bg-gray-100 text-gray-700 border-gray-300'}`}
          onClick={() => setTab('table')}
        >
          {t('orderTailsTabs.table')}
        </button>
        {/* Переключатель "только активные хвосты" — виден только на Table */}
        {tab === 'table' && (
          <label className="ml-4 inline-flex items-center gap-3 cursor-pointer select-none">
            <span className="text-sm text-gray-700">{t('orderTailsTable.activeOnly')}</span>
            <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${activeOnly ? 'bg-[#0d1c3d]' : 'bg-gray-300'}`}>
              <input
                type="checkbox"
                className="sr-only"
                checked={activeOnly}
                onChange={(e) => {
                  const value = (e.target as HTMLInputElement).checked;
                  setActiveOnly(value);
                  const ev = new CustomEvent('ot-toggle-active-only', { detail: { activeOnly: value } });
                  window.dispatchEvent(ev);
                }}
              />
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${activeOnly ? 'translate-x-5' : 'translate-x-1'}`} />
            </span>
          </label>
        )}
        {/* Слот для действий таблицы — как в Time Loss */}
        <div id="ot-actions-slot" className="ml-auto flex items-center gap-2" />
      </div>

      {tab === 'stats' && (
        <Stats rows={rowsCache ?? undefined} suppressLocalLoaders={isLoading} onLoadingChange={handleLoadingChange} />
      )}
      {tab === 'table' && (
        <TableView rows={rowsCache ?? undefined} suppressLocalLoaders={isLoading} onLoadingChange={handleLoadingChange} />
      )}
    </div>
  );
};

export default OrderTails;


