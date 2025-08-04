import React, { useState } from 'react';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { useTranslation } from 'react-i18next';
import Overview from './tabs/Overview/Overview';
import Details from './tabs/Details/Details';
import Analytics from './tabs/Analytics/Analytics';

const Production: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const { t } = useTranslation('production');

  return (
    <div className="p-4">
      <PageHeader
        title={t('pageTitle')}
        view={activeTab}
        onViewChange={setActiveTab}
        tabs={[
          { key: 'overview', label: t('overview') },
          { key: 'details', label: t('details') },
          { key: 'analytics', label: t('analytics') },
        ]}
      />
      {activeTab === 'overview' && <Overview />}
      {activeTab === 'details' && <Details />}
      {activeTab === 'analytics' && <Analytics />}
    </div>
  );
};

export default Production; 