import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageLayout } from '../../components/Layout';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { usePageView } from '../../hooks/usePageView';
import DefectCards from './tabs/DefectCards/DefectCards';
import LQC from './tabs/LQC/LQC';
import Dashboard from './tabs/Dashboard/Dashboard';

const QC: React.FC = () => {
  const { t } = useTranslation('qc');
  const [activeTab, setActiveTab] = useState('defectCards');
  usePageView('qc');

  return (
    <PageLayout>
      <PageHeader
        title={t('pageTitle')}
        view={activeTab}
        onViewChange={setActiveTab}
        tabs={[
          { key: 'defectCards', label: t('tabs.defectCards') },
          { key: 'lqc', label: t('tabs.lqc') },
          { key: 'dashboard', label: t('tabs.dashboard') },
        ]}
      />
      {activeTab === 'defectCards' && <DefectCards />}
      {activeTab === 'lqc' && <LQC />}
      {activeTab === 'dashboard' && <Dashboard />}
    </PageLayout>
  );
};

export default QC;
