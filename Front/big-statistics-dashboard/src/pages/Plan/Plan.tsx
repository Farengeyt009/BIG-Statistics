import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import MonthPlanGantt from './tabs/MonthPlanTab/MonthPlanGantt';
import MonthPlanSummary from './tabs/MonthPlanTab/MonthPlanSummary';
import WeeklyPlanTab from './tabs/WeeklyPlanTab';
import DailyPlanTab from './tabs/DailyPlanTab';
import MonthPlanTabs from './tabs/MonthPlanTab/MonthPlanTabs';
import { PageHeader } from '../../components/PageHeader/PageHeader';

console.log('Plan rendered');

const Plan = () => {
  const [activeTab, setActiveTab] = useState('month');
  const [activeMonthTab, setActiveMonthTab] = useState('gantt');
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
      {activeTab === 'month' && <MonthPlanTabs />}
      {activeTab === 'week' && <WeeklyPlanTab />}
      {activeTab === 'day' && <DailyPlanTab />}
    </div>
  );
};

export default Plan; 