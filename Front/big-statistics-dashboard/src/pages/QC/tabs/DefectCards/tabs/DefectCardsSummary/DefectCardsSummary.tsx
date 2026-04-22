import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import DefectCardsSummaryTable from './DefectCardsSummaryTable';
import DefectCardsSummaryChart from './DefectCardsSummaryChart';
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

const DefectCardsSummary: React.FC<Props> = ({ startDate, endDate }) => {
  const { t } = useTranslation('qc');
  const { data = [], isLoading, isFetching, error } = useQuery<any[]>({
    queryKey: ['qc-defect-cards-summary-table', startDate ? toYmdLocal(startDate) : null, endDate ? toYmdLocal(endDate) : null],
    enabled: Boolean(startDate && endDate),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append('date_from', toYmdLocal(startDate));
      if (endDate)   params.append('date_to',   toYmdLocal(endDate));
      const result = await fetchJsonGetDedup<any>(
        `/api/qc/defect-cards?${params.toString()}`,
        undefined,
        1200
      );
      return result?.data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const loading = isLoading || isFetching;

  return (
    <div className="flex gap-6 items-start">
      <DefectCardsSummaryTable
        data={data}
        loading={loading}
        error={error ? String((error as any)?.message || error) : null}
        title={t('wastes.summary.titleByDept')}
      />
      <div style={{ flexShrink: 0 }}>
        <div className="px-1 py-2 mb-1 text-sm font-semibold text-[#0d1c3d] border-b border-gray-200">
          {t('wastes.summary.defectCost')}
        </div>
        <DefectCardsSummaryChart data={data} loading={loading} />
      </div>
    </div>
  );
};

export default DefectCardsSummary;
