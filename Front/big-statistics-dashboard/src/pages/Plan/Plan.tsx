import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import MonthPlanTab from './tabs/MonthPlanTab';
import WeeklyPlanTab from './tabs/WeeklyPlanTab';
import DailyPlanTab from './tabs/DailyPlanTab';
import planTranslations from './PlanTranslation.json';

const Plan = () => {
  const [activeTab, setActiveTab] = useState('month');
  const { i18n } = useTranslation();
  const lang = i18n.language === 'zh' ? 'zh' : 'en';

  return (
    <div className="p-4">
      <header className="mb-4">
        <h1 className="text-2xl font-bold mb-2">{planTranslations.pageTitle[lang]}</h1>
        <div className="flex items-end justify-between">
          <ul className="flex gap-0.5 h-9">
            {[
              { label: planTranslations.tabs.month[lang], key: 'month' },
              { label: planTranslations.tabs.week[lang], key: 'week' },
              { label: planTranslations.tabs.day[lang], key: 'day' },
            ].map(tab => (
              <li key={tab.key}>
                <button
                  onClick={() => setActiveTab(tab.key)}
                  className={
                    `px-4 h-8 flex items-center rounded-t-md text-sm select-none ` +
                    (activeTab === tab.key
                      ? 'bg-white text-gray-900 border border-b-transparent'
                      : 'bg-gray-100 text-gray-500 hover:text-gray-800 border border-gray-300')
                  }
                >
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="-mt-px h-px bg-gray-300" />
      </header>
      {activeTab === 'month' && <MonthPlanTab />}
      {activeTab === 'week' && <WeeklyPlanTab />}
      {activeTab === 'day' && <DailyPlanTab />}
    </div>
  );
};

export default Plan; 