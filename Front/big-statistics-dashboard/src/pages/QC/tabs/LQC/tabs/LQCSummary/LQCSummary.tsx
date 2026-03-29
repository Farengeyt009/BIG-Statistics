import React from 'react';
import { useTranslation } from 'react-i18next';
import LQCSummaryTable from './LQCSummaryTable';

interface LQCSummaryProps {
  data: any[];
  loading: boolean;
  error: string | null;
}

const LQCSummary: React.FC<LQCSummaryProps> = ({ data, loading, error }) => {
  const { t } = useTranslation('qc');

  return (
    <div className="flex flex-col gap-6 p-2">
      <LQCSummaryTable
        data={data}
        loading={loading}
        error={error}
        variant="by-group"
        title={t('lqc.summary.titleByGroup')}
      />
      <LQCSummaryTable
        data={data}
        loading={loading}
        error={error}
        variant="by-defect"
        title={t('lqc.summary.titleByDefect')}
      />
    </div>
  );
};

export default LQCSummary;
