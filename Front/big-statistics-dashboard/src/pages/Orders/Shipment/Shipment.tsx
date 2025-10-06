import { useState } from 'react';
import { DateRangePickerPro, YearMonthRangePicker } from '../../../components/DatePicker';
import ShipmentLog from './Shipment_Log/ShipmentLog';
import ShipmentPlanFact from './Shipment_PlanFact/ShipmentPlanFact';
import Statistics from './Statistics/Statistics';
import { useTranslation } from 'react-i18next';

type ShipmentRow = {
  id: string;
  orderNo: string;
  articleNo: string;
  shipDate: string;
  qty: number;
};

type ShipmentProps = {
  startDate: Date | null;
  endDate: Date | null;
  onChangeDates: (from: Date, to: Date) => void;
  reloadToken?: number;
  previewRows?: any[] | null;
};

export default function Shipment({ startDate, endDate, onChangeDates, reloadToken, previewRows }: ShipmentProps) {
  const [rows] = useState<ShipmentRow[]>([]);
  const [activeSubtab, setActiveSubtab] = useState<'statistics' | 'planfact' | 'log'>('statistics');
  const { t, i18n } = useTranslation('ordersTranslation');
  const currentLanguage = (i18n.language as 'en' | 'zh' | 'ru') || 'en';
  const today = new Date();
  // By default select the whole current year (Jan..Dec)
  const [pfFrom, setPfFrom] = useState<Date>(new Date(today.getFullYear(), 0, 1));
  const [pfTo, setPfTo] = useState<Date>(new Date(today.getFullYear(), 11, 1));
  // For Statistics: default to current month (single month)
  const [statsFrom, setStatsFrom] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
  const [statsTo, setStatsTo] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));

  return (
    <div className="p-2">
      <div className="flex items-center gap-6 mb-3">
        {/* Внутренние вкладки: как на Production */}
        <div className="flex gap-2">
          <button
            className={`px-4 py-1 rounded-md text-sm font-medium border transition-colors ${
              activeSubtab === 'statistics'
                ? 'bg-[#0d1c3d] text-white border-[#0d1c3d]'
                : 'bg-gray-100 text-gray-700 border-gray-300'
            }`}
            onClick={() => setActiveSubtab('statistics')}
          >
            {t('tabs.statistics')}
          </button>
          <button
            className={`px-4 py-1 rounded-md text-sm font-medium border transition-colors ${
              activeSubtab === 'planfact'
                ? 'bg-[#0d1c3d] text-white border-[#0d1c3d]'
                : 'bg-gray-100 text-gray-700 border-gray-300'
            }`}
            onClick={() => setActiveSubtab('planfact')}
          >
            {t('tabs.shipmentPlanFact')}
          </button>
          <button
            className={`px-4 py-1 rounded-md text-sm font-medium border transition-colors ${
              activeSubtab === 'log'
                ? 'bg-[#0d1c3d] text-white border-[#0d1c3d]'
                : 'bg-gray-100 text-gray-700 border-gray-300'
            }`}
            onClick={() => setActiveSubtab('log')}
          >
            {t('tabs.shipmentLog')}
          </button>
        </div>

        {/* Для вкладки Statistics и Plan-Fact используем YearMonthRangePicker; для Log используется собственный DateRangePickerPro. */}
        {activeSubtab === 'statistics' && (
          <div className="flex items-center gap-2">
            <YearMonthRangePicker
              from={statsFrom}
              to={statsTo}
              onApply={(f, t) => { setStatsFrom(f); setStatsTo(t); }}
              locale={currentLanguage === 'ru' ? 'ru' : currentLanguage === 'zh' ? 'zh' : 'en'}
              className="w-auto"
              position="right"
              selectionMode="single"
            />
          </div>
        )}

        {activeSubtab === 'planfact' && (
          <div className="flex items-center gap-2">
            <YearMonthRangePicker
              from={pfFrom}
              to={pfTo}
              onApply={(f, t) => { setPfFrom(f); setPfTo(t); }}
              locale={currentLanguage === 'ru' ? 'ru' : currentLanguage === 'zh' ? 'zh' : 'en'}
              className="w-auto"
              position="right"
            />
          </div>
        )}

        {activeSubtab === 'log' && (
          <div className="flex items-center gap-2">
            <DateRangePickerPro
              mode="range"
              startDate={startDate ?? undefined}
              endDate={endDate ?? undefined}
              onApply={(f, t) => { onChangeDates(f, t); }}
              locale={currentLanguage === 'ru' ? 'ru' : currentLanguage === 'zh' ? 'zh' : 'en'}
              className="w-auto"
              position="left"
            />
          </div>
        )}

        {/* Слот для иконок таблицы справа */}
        <div id="shipment-actions-slot" className="ml-auto flex items-center gap-2" />
      </div>

      {activeSubtab === 'statistics' && (
        <Statistics fromDate={statsFrom} toDate={statsTo} />
      )}

      {activeSubtab === 'planfact' && (
        <ShipmentPlanFact fromDate={pfFrom} toDate={pfTo} />
      )}

      {activeSubtab === 'log' && (
        <ShipmentLog startDate={startDate} endDate={endDate} reloadToken={reloadToken} rowsOverride={previewRows ?? undefined} />
      )}
    </div>
  );
}


