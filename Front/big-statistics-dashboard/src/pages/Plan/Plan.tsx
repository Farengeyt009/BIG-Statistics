import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import MonthPlanTab from './tabs/MonthPlanTab';
import WeeklyPlanTab from './tabs/WeeklyPlanTab';
import DailyPlanTab from './tabs/DailyPlanTab';
import planTranslations from './PlanTranslation.json';
import { PageHeader } from '../../components/PageHeader/PageHeader';

const Plan = () => {
  const [activeTab, setActiveTab] = useState('month');
  const { i18n } = useTranslation();
  const lang = i18n.language === 'zh' ? 'zh' : 'en';

  return (
    <div className="p-4">
      <PageHeader
        title={planTranslations.pageTitle[lang]}
        view={activeTab as 'month' | 'week' | 'day'}
        onViewChange={(v: 'month' | 'week' | 'day') => setActiveTab(v)}
      />
      {activeTab === 'month' && <MonthPlanTab />}
      {activeTab === 'week' && <WeeklyPlanTab />}
      {activeTab === 'day' && <DailyPlanTab />}
    </div>
  );
};

export default Plan; 