import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import MonthPlanTab from './tabs/MonthPlanTab';
import WeeklyPlanTab from './tabs/WeeklyPlanTab';
import DailyPlanTab from './tabs/DailyPlanTab';
import { PageHeader } from '../../components/PageHeader/PageHeader';

const Plan = () => {
  const [activeTab, setActiveTab] = useState('month');
  const { t } = useTranslation('planTranslation');

  return (
    <div className="p-4">
      <PageHeader
        title={t('pageTitle')}
        view={activeTab}
        onViewChange={setActiveTab}
        tabs={[
          { key: 'month', label: t('tabs.month') },
          { key: 'week', label: t('tabs.week') },
          { key: 'day', label: t('tabs.day') },
        ]}
      />
      {activeTab === 'month' && <MonthPlanTab />}
      {activeTab === 'week' && <WeeklyPlanTab />}
      {activeTab === 'day' && <DailyPlanTab />}
    </div>
  );
};

export default Plan; 