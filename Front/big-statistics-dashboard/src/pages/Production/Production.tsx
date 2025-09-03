import React, { useState } from 'react';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { useTranslation } from 'react-i18next';
import DailyPlanFact from './tabs/DailyPlanFact/DailyPlanFact';
import TimeLoss from './tabs/TimeLoss/TimeLoss';
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
          { key: 'timeLoss', label: t('timeLoss') },
          { key: 'analytics', label: t('analytics') },
        ]}
      />
      {activeTab === 'dailyPlanFact' && <DailyPlanFact />}
      {activeTab === 'timeLoss' && <TimeLoss />}
      {activeTab === 'analytics' && <WorkingCalendar />}
    </div>
  );
};

export default Production; 