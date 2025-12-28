import React, { useState, useEffect } from 'react';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { PageLayout } from '../../components/Layout';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import DailyPlanFact from './tabs/DailyPlanFact/DailyPlanFact';
import TimeLoss from './tabs/TimeLoss/TimeLoss';
import WorkingCalendar from './tabs/WorkingCalendar/WorkingCalendar';
import OrderTails from './tabs/OrderTails/OrderTails';
import { usePageView } from '../../hooks/usePageView';

const Production: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'analytics');
  const { t } = useTranslation('production');
  
  // Обновляем активную вкладку при изменении параметра в URL
  useEffect(() => {
    if (tabFromUrl && ['analytics', 'dailyPlanFact', 'timeLoss', 'orderTails'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);
  
  // Логируем посещение страницы Production
  usePageView('production');

  return (
    <PageLayout>
      <PageHeader
        title={t('pageTitle')}
        view={activeTab}
        onViewChange={setActiveTab}
        tabs={[
          { key: 'analytics', label: t('analytics') },
          { key: 'dailyPlanFact', label: t('Daily Plan-Fact') },
          { key: 'timeLoss', label: t('timeLoss') },
          { key: 'orderTails', label: t('orderTails') },
        ]}
      />
      {activeTab === 'analytics' && <WorkingCalendar />}
      {activeTab === 'dailyPlanFact' && <DailyPlanFact />}
      {activeTab === 'timeLoss' && <TimeLoss />}
      {activeTab === 'orderTails' && <OrderTails />}
    </PageLayout>
  );
};

export default Production; 