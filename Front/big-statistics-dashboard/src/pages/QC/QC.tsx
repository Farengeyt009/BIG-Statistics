import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PageLayout } from '../../components/Layout';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { usePageView } from '../../hooks/usePageView';
import DefectCards from './tabs/DefectCards/DefectCards';
import LQC from './tabs/LQC/LQC';
import Dashboard from './tabs/Dashboard/Dashboard';
import Wastes from './tabs/Wastes/Wastes';

const VALID_TABS = ['dashboard', 'lqc', 'defectCards', 'wastes'];

const QC: React.FC = () => {
  const { t } = useTranslation('qc');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'dashboard'
  );
  usePageView('qc');

  useEffect(() => {
    if (tabFromUrl && VALID_TABS.includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    navigate(`/qc?tab=${tab}`, { replace: true });
  };

  return (
    <PageLayout>
      <PageHeader
        title={t('pageTitle')}
        view={activeTab}
        onViewChange={handleTabChange}
        tabs={[
          { key: 'dashboard', label: t('tabs.dashboard') },
          { key: 'lqc', label: t('tabs.lqc') },
          { key: 'defectCards', label: t('tabs.defectCards') },
          { key: 'wastes', label: t('tabs.wastes') },
        ]}
      />
      {activeTab === 'dashboard' && <Dashboard />}
      {activeTab === 'defectCards' && <DefectCards />}
      {activeTab === 'lqc' && <LQC />}
      {activeTab === 'wastes' && <Wastes />}
    </PageLayout>
  );
};

export default QC;
