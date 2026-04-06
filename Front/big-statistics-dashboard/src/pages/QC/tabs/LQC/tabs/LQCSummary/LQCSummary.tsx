import React from 'react';
import { useTranslation } from 'react-i18next';
import LQCSummaryTable from './LQCSummaryTable';
import LQCDefectChart from './LQCDefectChart';

interface LQCSummaryProps {
  data: any[];
  loading: boolean;
  error: string | null;
  startDate: Date | null;
  endDate: Date | null;
}

const LQCSummary: React.FC<LQCSummaryProps> = ({ data, loading, error, startDate, endDate }) => {
  const { t } = useTranslation('qc');

  return (
    <div className="flex flex-col gap-6 p-2">

      {/* By Product Group + Defect % chart */}
      <div className="flex gap-8 items-start">
        <div style={{ width: 1100, flexShrink: 0 }}>
          <LQCSummaryTable
            data={data}
            loading={loading}
            error={error}
            variant="by-group"
            title={t('lqc.summary.titleByGroup')}
          />
        </div>
        <div style={{ width: 640, flexShrink: 0 }}>
          <div className="text-sm font-semibold text-[#0d1c3d] px-1 py-2 mb-1 border-b border-gray-200">
            {t('lqc.summary.defectPctByDate')}
          </div>
          <div style={{ height: 280 }}>
            <LQCDefectChart data={data} startDate={startDate} endDate={endDate} metric="pct" />
          </div>
        </div>
      </div>

      {/* By Defect Type + Defect QTY chart */}
      <div className="flex gap-8 items-start">
        <div style={{ width: 1100, flexShrink: 0 }}>
          <LQCSummaryTable
            data={data}
            loading={loading}
            error={error}
            variant="by-defect"
            title={t('lqc.summary.titleByDefect')}
          />
        </div>
        <div style={{ width: 640, flexShrink: 0 }}>
          <div className="text-sm font-semibold text-[#0d1c3d] px-1 py-2 mb-1 border-b border-gray-200">
            {t('lqc.summary.defectByDate')}
          </div>
          <div style={{ height: 280 }}>
            <LQCDefectChart data={data} startDate={startDate} endDate={endDate} metric="defect" />
          </div>
        </div>
      </div>

    </div>
  );
};

export default LQCSummary;
