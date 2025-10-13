import React, { useEffect, useMemo, useRef, useState } from 'react';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
import { useTranslation } from 'react-i18next';
import { DateRangePickerPro } from '../../../../components/DatePicker';
import Overview from './Overview';
import Table from './Table';
import DailyStaffing from './Daily_Staffing/DailyStaffing';
import { Factory } from 'lucide-react';
import { apiGetDicts } from '../../../../config/timeloss-api';
import { useAuth } from '../../../../context/AuthContext';

const TimeLoss: React.FC = () => {
  const { i18n, t } = useTranslation('production');
  const currentLanguage = i18n.language as 'en' | 'zh' | 'ru';
  const { hasPermission } = useAuth();
  
  // Проверка прав на редактирование Time Loss
  const canEditFull = hasPermission('production_timeloss_edit', 'edit');
  const canEditLimited = hasPermission('production_timeloss_limited_edit', 'edit');
  
  const [activeTab, setActiveTab] = useState<'overview' | 'table' | 'staffing'>('overview');

  // Состояния загрузки компонентов (по умолчанию false, устанавливаются в true при начале загрузки)
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);
  const [isTableLoading, setIsTableLoading] = useState(false);

  // Глобальный лоадер показывается пока хотя бы один компонент грузится
  const showGlobalLoader = isOverviewLoading || isTableLoading;
  // Инициализация последними 30 днями, включая сегодня
  const today = new Date();
  const start30 = new Date(today);
  start30.setDate(today.getDate() - 29);
  const [startDate, setStartDate] = useState<Date | null>(start30);
  const [endDate, setEndDate] = useState<Date | null>(today);

  // Workshops picker state (like Working Calendar)
  type WorkshopOption = { id: string; name: string };
  const [workshops, setWorkshops] = useState<WorkshopOption[]>([]);
  const [selectedWorkShopIds, setSelectedWorkShopIds] = useState<string[]>([]);
  const [isWorkshopPickerOpen, setIsWorkshopPickerOpen] = useState(false);
  const [draftWorkshopIds, setDraftWorkshopIds] = useState<string[]>([]);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  // Click outside to close picker
  useEffect(() => {
    if (!isWorkshopPickerOpen) return;
    const onClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsWorkshopPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [isWorkshopPickerOpen]);

  // Load workshops list from timeloss dicts
  useEffect(() => {
    const load = async () => {
      try {
        const raw = await apiGetDicts();
        // Build options similar to TimeLossTable.buildWSWCDicts
        let list: any[] = [];
        if (Array.isArray(raw?.Ref?.WorkShop_CustomWS)) list = raw.Ref.WorkShop_CustomWS;
        else if (Array.isArray(raw?.WorkShop_CustomWS)) list = raw.WorkShop_CustomWS;
        else if (Array.isArray((raw as any)?.['Ref.WorkShop_CustomWS'])) list = (raw as any)['Ref.WorkShop_CustomWS'];
        else if (Array.isArray(raw?.ref?.WorkShop_CustomWS)) list = raw.ref.WorkShop_CustomWS;

        const wsMap = new Map<string, WorkshopOption>();
        for (const rec of list) {
          const wsId = String(rec?.WorkShop_CustomWS ?? rec?.WorkShopID ?? rec?.WorkShop ?? '');
          if (!wsId) continue;
          const name = currentLanguage === 'zh'
            ? (rec?.WorkShopName_ZH || rec?.WorkShopName_EN || wsId)
            : currentLanguage === 'en'
              ? (rec?.WorkShopName_EN || rec?.WorkShopName_ZH || wsId)
              : (rec?.WorkShopName_EN || rec?.WorkShopName_ZH || wsId);
          if (!wsMap.has(wsId)) wsMap.set(wsId, { id: wsId, name });
        }
        const items = Array.from(wsMap.values());
        setWorkshops(items);
        if (items.length && selectedWorkShopIds.length === 0) {
          setSelectedWorkShopIds(items.map(i => i.id));
        }
      } catch (e) {
        // ignore
      }
    };
    load();
  }, [currentLanguage]);

  const allSelected = workshops.length > 0 && draftWorkshopIds.length === workshops.length;
  const someSelected = draftWorkshopIds.length > 0 && draftWorkshopIds.length < workshops.length;
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected, isWorkshopPickerOpen, workshops, draftWorkshopIds]);

  const handleDateRangeApply = (from: Date, to?: Date) => {
    setStartDate(from);
    setEndDate(to || from);
    // Здесь можно добавить загрузку данных при изменении дат
    // loadTimeLossData(from, to || from);
  };

  // ISO строки диапазона для таблицы
  const startIso = startDate ? startDate.toISOString().split('T')[0] : undefined;
  const endIso = endDate ? endDate.toISOString().split('T')[0] : undefined;

  const workshopsButtonLabel = useMemo(() => {
    const cnt = selectedWorkShopIds.length;
    if (cnt === 0 || cnt === workshops.length) return (t('multiSelect') as string) || 'Multi-select';
    if (cnt === 1) return workshops.find(w => w.id === selectedWorkShopIds[0])?.name || ((t('chooseWorkshop') as string) || 'Choose workshop');
    return (t('multiSelect') as string) || 'Multi-select';
  }, [selectedWorkShopIds, workshops, t]);

  return (
    <div className="p-2 relative min-h-[70vh]">
      {/* Глобальный оверлей пока компоненты грузятся */}
      {showGlobalLoader && (
        <LoadingSpinner overlay size="xl" />
      )}
      <div className="flex items-center gap-6 mb-3">
        {/* Внутренние вкладки */}
        <div className="flex gap-2">
          <button
            className={`px-4 py-1 rounded-md text-sm font-medium border transition-colors ${
              activeTab === 'overview' 
                ? 'bg-[#0d1c3d] text-white border-[#0d1c3d]' 
                : 'bg-gray-100 text-gray-700 border-gray-300'
            }`}
            onClick={() => setActiveTab('overview')}
          >
            {t('overview')}
          </button>
          <button
            className={`px-4 py-1 rounded-md text-sm font-medium border transition-colors ${
              activeTab === 'table' 
                ? 'bg-[#0d1c3d] text-white border-[#0d1c3d]' 
                : 'bg-gray-100 text-gray-700 border-gray-300'
            }`}
            onClick={() => setActiveTab('table')}
          >
            {t('table')}
          </button>
          <button
            className={`px-4 py-1 rounded-md text-sm font-medium border transition-colors ${
              activeTab === 'staffing' 
                ? 'bg-[#0d1c3d] text-white border-[#0d1c3d]' 
                : 'bg-gray-100 text-gray-700 border-gray-300'
            }`}
            onClick={() => setActiveTab('staffing')}
          >
            {t('dailyStaffing')}
          </button>
        </div>
        
        {/* Дата пикер */}
        <div className="flex items-center gap-2">
          <DateRangePickerPro
            mode="range"
            startDate={startDate}
            endDate={endDate}
            onApply={handleDateRangeApply}
            placeholder={t('selectDateRange')}
            className="w-64"
          />
        </div>

        {/* Workshops picker (like Working Calendar) - только для таблицы */}
        {activeTab === 'table' && (
          <div className="flex items-center gap-2">
            <div className="flex items-center space-x-2">
              <Factory className="w-5 h-5 text-gray-600" />
              <div className="relative" ref={pickerRef}>
                <button
                  type="button"
                  onClick={() => { setDraftWorkshopIds(selectedWorkShopIds.length ? selectedWorkShopIds : workshops.map(w => w.id)); setIsWorkshopPickerOpen(v => !v); }}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                  title={t('workshops') || 'Workshops'}
                >
                  {workshopsButtonLabel}
                </button>

                {isWorkshopPickerOpen && (
                  <div className="absolute z-50 right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-2xl">
                    <div className="p-3 max-h-64 overflow-auto space-y-2">
                      <label className="flex items-center space-x-2 text-sm font-medium pb-2 border-b border-gray-100">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          checked={allSelected}
                          onChange={() => {
                            if (allSelected) setDraftWorkshopIds([]);
                            else setDraftWorkshopIds(workshops.map(w => w.id));
                          }}
                        />
                        <span>{t('selectAll') || 'Select All'}</span>
                      </label>
                      {workshops.map(w => (
                        <label key={w.id} className="flex items-center space-x-2 text-sm">
                          <input
                            type="checkbox"
                            checked={draftWorkshopIds.includes(w.id)}
                            onChange={(e) => setDraftWorkshopIds(prev => e.target.checked ? [...prev, w.id] : prev.filter(id => id !== w.id))}
                          />
                          <span>{w.name}</span>
                        </label>
                      ))}
                      {workshops.length === 0 && (
                        <div className="text-xs text-gray-500">{t('loading') || 'Loading...'}</div>
                      )}
                    </div>
                    <div className="px-3 py-2 border-t border-gray-200 flex justify-end space-x-2 bg-gray-50 rounded-b-lg">
                      <button className="px-3 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200" onClick={() => setIsWorkshopPickerOpen(false)}>
                        {t('cancel')}
                      </button>
                      <button
                        className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
                        onClick={() => { setSelectedWorkShopIds(draftWorkshopIds.length ? draftWorkshopIds : workshops.map(w => w.id)); setIsWorkshopPickerOpen(false); }}
                      >
                        OK
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Слот для кнопок действий таблицы */}
        <div id="tl-actions-slot" className="ml-auto flex items-center gap-2" />
      </div>
      
      {/* Содержимое табов */}
      {activeTab === 'overview' && (
        <Overview
          startDate={startIso}
          endDate={endIso}
          suppressLocalLoaders={showGlobalLoader}
          onLoadingChange={setIsOverviewLoading}
          isActive={true}
        />
      )}
      {activeTab === 'table' && (
        <Table
          startDate={startIso}
          endDate={endIso}
          selectedWorkShopIds={selectedWorkShopIds}
          suppressLocalLoaders={showGlobalLoader}
          onLoadingChange={setIsTableLoading}
          isActive={true}
          canEditFull={canEditFull}
          canEditLimited={canEditLimited}
        />
      )}
      {activeTab === 'staffing' && (
        <DailyStaffing
          startDate={startIso}
          endDate={endIso}
          suppressLocalLoaders={showGlobalLoader}
          onLoadingChange={setIsTableLoading}
          isActive={true}
        />
      )}
    </div>
  );
};

export default TimeLoss;
