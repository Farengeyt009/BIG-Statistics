import React, { useState } from 'react';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { useTranslation } from 'react-i18next';
import DailyPlanFact from './tabs/DailyPlanFact/DailyPlanFact';
import Details from './tabs/Details/Details';
import WorkingCalendar from './tabs/WorkingCalendar/WorkingCalendar';

const Production: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dailyPlanFact');
  const { t } = useTranslation('production');

  return (
    <div className="p-4">
      <PageHeader
        title={t('pageTitle')}
        view={activeTab}
        onViewChange={setActiveTab}
        tabs={[
          { key: 'dailyPlanFact', label: t('Daily Plan-Fact') },
          { key: 'details', label: t('details') },
          { key: 'analytics', label: t('analytics') },
        ]}
      />
      {activeTab === 'dailyPlanFact' && <DailyPlanFact />}
      {activeTab === 'details' && <Details />}
      {activeTab === 'analytics' && <WorkingCalendar />}
    </div>
  );
};

export default Production; 