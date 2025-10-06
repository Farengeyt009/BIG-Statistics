import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API_ENDPOINTS } from '../../../config/api';

type MatchType = 'StartsWith' | 'Contains' | 'Equals' | 'EndsWith';
type MatchTypeExt = MatchType | 'NullOrEmpty' | 'IsNull';

type Rule = {
  RuleID?: number;
  MatchType: MatchTypeExt | string;
  Pattern: string;
  IsExclude: number | boolean;
  IsActive: number | boolean;
  Priority?: number;
  Comment?: string | null;
};

type ShipmentFilterModalProps = {
  isOpen: boolean;
  onClose: () => void;
  startDate: Date | null;
  endDate: Date | null;
  onPublished?: () => void;
  onApplyPreview?: (rows: any[]) => void;
};

// Runtime cache (resets on full page reload)
let shipmentFiltersDraft: { rules: Rule[]; showEmpty: boolean } | null = null;

export default function ShipmentFilterModal({ isOpen, onClose, startDate, endDate, onPublished, onApplyPreview }: ShipmentFilterModalProps) {
  const { t } = useTranslation('ordersTranslation');
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<'preview' | 'publish'>('preview');
  const [previewInfo, setPreviewInfo] = useState<{ total: number; start: string; end: string; mode: string } | null>(null);
  const canPreview = useMemo(() => Boolean(startDate && endDate), [startDate, endDate]);
  const [dirty, setDirty] = useState(false);
  const [showEmpty, setShowEmpty] = useState<boolean>(false);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setError(null);
      setPreviewInfo(null);
      setLoading(true);
      try {
        if (shipmentFiltersDraft) {
          if (!ignore) {
            setRules(shipmentFiltersDraft.rules);
            setShowEmpty(shipmentFiltersDraft.showEmpty);
            setDirty(true);
          }
        } else {
          const res = await fetch(API_ENDPOINTS.ORDERS.SHIPMENT_FILTERS);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          if (!ignore) {
            const allRules: Rule[] = Array.isArray(json.rules) ? json.rules : [];
            const nullRules = allRules.filter((r: any) => String(r.MatchType) === 'NullOrEmpty');
            // Определяем состояние чекбокса по опубликованным правилам
            const hasInclude = nullRules.some((r: any) => Number(r.IsActive ? 1 : 0) === 1 && Number(r.IsExclude ? 1 : 0) === 0);
            const hasExclude = nullRules.some((r: any) => Number(r.IsActive ? 1 : 0) === 1 && Number(r.IsExclude ? 1 : 0) === 1);
            setShowEmpty(hasInclude ? true : hasExclude ? false : false);
            // Скрываем NullOrEmpty из пользовательского списка правил
            const rest = allRules.filter((r: any) => String(r.MatchType) !== 'NullOrEmpty');
            setRules(rest as Rule[]);
            setDirty(false);
          }
        }
      } catch (e: any) {
        if (!ignore) setError(`Не удалось загрузить правила: ${e?.message ?? e}`);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    if (isOpen) {
      load();
    }
    return () => { ignore = true; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePreview = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);
    setPreviewInfo(null);
    try {
      const baseRules = rules.map(r => ({
        MatchType: r.MatchType,
        Pattern: r.Pattern,
        IsExclude: Number(r.IsExclude ? 1 : 0),
        IsActive: Number(r.IsActive ? 1 : 0),
        Priority: r.Priority ?? 100,
        Comment: r.Comment ?? null,
      }));
      // Добавляем виртуальное правило для пустых/NULL
      baseRules.push({
        MatchType: 'NullOrEmpty',
        Pattern: '',
        IsExclude: showEmpty ? 0 : 1,
        IsActive: 1,
        Priority: 1,
        Comment: null,
      } as any);
      const body = {
        start_date: startDate.toISOString().slice(0, 10),
        end_date: endDate.toISOString().slice(0, 10),
        mode: 'override',
        rules: baseRules,
      };
      const res = await fetch(API_ENDPOINTS.ORDERS.SHIPMENT_PREVIEW, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setPreviewInfo({ total: Number(json.total_records ?? 0), start: String(json.start_date), end: String(json.end_date), mode: String(json.mode) });
      if (onApplyPreview && Array.isArray(json.data)) {
        // Cache current draft (rules + showEmpty) so it persists while the page is alive
        shipmentFiltersDraft = { rules, showEmpty };
        onApplyPreview(json.data);
        onClose();
      }
    } catch (e: any) {
      setError(`Ошибка preview: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    setLoading(true);
    setError(null);
    try {
      const rulesToSend = rules.map(r => ({
        MatchType: r.MatchType,
        Pattern: r.Pattern,
        IsExclude: Number(r.IsExclude ? 1 : 0),
        IsActive: Number(r.IsActive ? 1 : 0),
        Priority: r.Priority ?? 100,
        Comment: r.Comment ?? null,
      }));
      rulesToSend.push({
        MatchType: 'NullOrEmpty',
        Pattern: '',
        IsExclude: showEmpty ? 0 : 1,
        IsActive: 1,
        Priority: 1,
        Comment: null,
      } as any);
      const body = { rules: rulesToSend };
      const res = await fetch(API_ENDPOINTS.ORDERS.SHIPMENT_FILTERS_PUBLISH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json && json.ok) {
        setDirty(false);
        // On publish, clear draft cache so next open reflects DB state
        shipmentFiltersDraft = null;
        if (onPublished) onPublished();
      }
    } catch (e: any) {
      setError(`Ошибка publish: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (actionMode === 'preview') {
      await handlePreview();
    } else {
      await handlePublish();
    }
  };

  const handleAddRule = () => {
    setRules(prev => [
      ...prev,
      { MatchType: 'StartsWith', Pattern: '', IsExclude: 1, IsActive: 1, Priority: 100, Comment: '' }
    ]);
    setDirty(true);
  };

  const handleDeleteRule = (index: number) => {
    setRules(prev => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const updateRule = (index: number, patch: Partial<Rule>) => {
    setRules(prev => prev.map((r, i) => i === index ? { ...r, ...patch } : r));
    setDirty(true);
  };

  const handleReset = async () => {
    // перезагрузить опубликованные правила
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_ENDPOINTS.ORDERS.SHIPMENT_FILTERS);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setRules(Array.isArray(json.rules) ? json.rules : []);
      setDirty(false);
      setPreviewInfo(null);
    } catch (e: any) {
      setError(`Не удалось загрузить правила: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleIncludeNullEmpty = (checked: boolean) => {
    setShowEmpty(checked);
    setDirty(true);
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 z-0" />

      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 h-[75vh] max-h-[90vh] overflow-hidden relative z-10 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-[#0d1c3d]">{t('filtersModal.title')}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
            title="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 overflow-auto">
          {/* Левая часть — Save mode */}
          <div className="w-2/5 p-6 border-r border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">{t('filtersModal.saveMode')}</h3>
            <div className="space-y-2">
              <div
                className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                  actionMode === 'preview'
                    ? 'bg-blue-100 border-blue-300 text-blue-800'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-800'
                }`}
                onClick={() => setActionMode('preview')}
              >
                <div className="font-medium">Preview</div>
                <div className="text-xs text-slate-600 mt-1">{t('filtersModal.modes.previewHint')}</div>
              </div>

              <div
                className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                  actionMode === 'publish'
                    ? 'bg-blue-100 border-blue-300 text-blue-800'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-800'
                }`}
                onClick={() => setActionMode('publish')}
              >
                <div className="font-medium">Publish</div>
                <div className="text-xs text-slate-600 mt-1">{t('filtersModal.modes.publishHint')}</div>
              </div>
            </div>
          </div>

          {/* Правая часть — Rules */}
          <div className="w-3/5 p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-800">{t('filtersModal.rules')}</h3>
            </div>
            {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
              {/* Управляющая строка Show Empty (наверху), без удаления */}
              <div className="p-2 rounded-lg border bg-white grid grid-cols-[150px_1fr_auto] items-center gap-2">
                <span className="text-sm text-gray-800">{t('filtersModal.showEmpty')}</span>
                <div />
                <label className="text-xs text-slate-700 flex items-center gap-1">
                  <input type="checkbox" checked={showEmpty} onChange={(e) => toggleIncludeNullEmpty(e.target.checked)} />
                  {t('filtersModal.active')}
                </label>
              </div>

              {rules.length === 0 ? (
                <div className="text-sm text-slate-500">-</div>
              ) : (
                rules.map((r, idx) => (
                  <div key={idx} className="p-2 rounded-lg border bg-white grid grid-cols-[150px_1fr_auto] items-center gap-2">
                    <select
                      value={String(r.MatchType) as MatchTypeExt}
                      onChange={e => updateRule(idx, { MatchType: e.target.value, ...(e.target.value === 'NullOrEmpty' || e.target.value === 'IsNull' ? { Pattern: '' } : {}) })}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      <option value="StartsWith">{t('filtersModal.matchTypes.StartsWith')}</option>
                      <option value="Contains">{t('filtersModal.matchTypes.Contains')}</option>
                      <option value="Equals">{t('filtersModal.matchTypes.Equals')}</option>
                      <option value="EndsWith">{t('filtersModal.matchTypes.EndsWith')}</option>
                      <option value="NullOrEmpty">{t('filtersModal.matchTypes.NullOrEmpty')}</option>
                      <option value="IsNull">{t('filtersModal.matchTypes.IsNull')}</option>
                    </select>
                    <input
                      value={r.Pattern}
                      onChange={e => updateRule(idx, { Pattern: e.target.value })}
                      disabled={String(r.MatchType) === 'NullOrEmpty' || String(r.MatchType) === 'IsNull'}
                      className="border rounded px-2 py-1 text-sm w-full"
                      placeholder="Pattern"
                    />
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-slate-700 flex items-center gap-1">
                        <input type="checkbox" checked={Boolean(r.IsActive)} onChange={e => updateRule(idx, { IsActive: e.target.checked ? 1 : 0 })} />
                        {t('filtersModal.active')}
                      </label>
                      <button
                        className={`${actionMode === 'preview' ? 'p-1 text-slate-300 cursor-not-allowed' : 'p-1 text-red-600 hover:text-red-700 transition-colors'}`}
                        onClick={actionMode === 'preview' ? undefined : () => handleDeleteRule(idx)}
                        title="Delete"
                        aria-label="Delete rule"
                        disabled={actionMode === 'preview'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleAddRule}
                className="px-3 py-1 rounded-md border border-gray-300 bg-white text-slate-700 hover:bg-gray-100 text-sm"
              >
                {t('filtersModal.addRule')}
              </button>
              <button
                onClick={handleReset}
                className="px-3 py-1 rounded-md border border-gray-300 bg-white text-slate-700 hover:bg-gray-100 text-sm"
              >
                {t('filtersModal.reset')}
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-gray-300 bg-white text-slate-700 hover:bg-gray-100 transition"
          >
            {t('filtersModal.close')}
          </button>
          <button
            onClick={handleSave}
            disabled={loading || (actionMode === 'preview' ? !canPreview : !dirty)}
            className="px-4 py-2 rounded-md bg-[#0d1c3d] text-white hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('filtersModal.save')}
          </button>
        </div>
      </div>
    </div>
  );
}


