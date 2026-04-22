import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import WastesSummaryTable from './WastesSummaryTable';
import WastesSummaryChart from './WastesSummaryChart';
import { fetchJsonGetDedup } from '../../../../../../utils/fetchDedup';

const toYmdLocal = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

interface Props {
  startDate: Date | null;
  endDate: Date | null;
}

const WastesSummary: React.FC<Props> = ({ startDate, endDate }) => {
  const { t } = useTranslation('qc');
  const dateParams = () => {
    const p = new URLSearchParams();
    if (startDate) p.append('date_from', toYmdLocal(startDate));
    if (endDate)   p.append('date_to',   toYmdLocal(endDate));
    return p.toString();
  };

  const enabled = Boolean(startDate && endDate);

  const { data: stampingData = [], isLoading: stampingLoading, error: stampingError } = useQuery<any[]>({
    queryKey: ['wastes-summary-stamping', startDate ? toYmdLocal(startDate) : null, endDate ? toYmdLocal(endDate) : null],
    enabled,
    queryFn: async () => {
      const json = await fetchJsonGetDedup<any>(
        `/api/qc/stamping-wastes?${dateParams()}`,
        undefined,
        1200
      );
      return json?.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const { data: injectionData = [], isLoading: injectionLoading, error: injectionError } = useQuery<any[]>({
    queryKey: ['wastes-summary-injection', startDate ? toYmdLocal(startDate) : null, endDate ? toYmdLocal(endDate) : null],
    enabled,
    queryFn: async () => {
      const json = await fetchJsonGetDedup<any>(
        `/api/qc/plastic-wastes?${dateParams()}`,
        undefined,
        1200
      );
      return json?.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const { data: deptData = [], isLoading: deptLoading } = useQuery<any[]>({
    queryKey: ['defect-cards-by-dept', startDate ? toYmdLocal(startDate) : null, endDate ? toYmdLocal(endDate) : null],
    enabled,
    queryFn: async () => {
      const json = await fetchJsonGetDedup<any>(
        `/api/qc/defect-cards-by-dept?${dateParams()}`,
        undefined,
        1200
      );
      return json?.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const error = stampingError || injectionError;
  const chartLoading = stampingLoading || injectionLoading || deptLoading;

  return (
    <div className="flex gap-6 items-start">
      <WastesSummaryTable
        stampingData={stampingData}
        injectionData={injectionData}
        loading={stampingLoading || injectionLoading}
        error={error ? String((error as any)?.message || error) : null}
        title={t('wastes.summary.titleByWorkshop')}
      />
      {!chartLoading && (
        <div style={{ flexShrink: 0 }}>
          <div className="px-1 py-2 mb-1 text-sm font-semibold text-[#0d1c3d] border-b border-gray-200">
            {t('wastes.summary.defectCost')}
          </div>
          <WastesSummaryChart deptData={deptData} />
        </div>
      )}
    </div>
  );
};

export default WastesSummary;
