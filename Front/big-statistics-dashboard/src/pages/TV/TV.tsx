import React, { useState } from 'react';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { useTranslation } from 'react-i18next';
import TV from './tabs/TV';
import { TVWall } from './TVWall';
import Table from './tabs/Table';

const TVPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('tv');
  const { t } = useTranslation('tv');

  return (
    <div className="p-4">
      <PageHeader
        title={t('pageTitle')}
        view={activeTab}
        onViewChange={setActiveTab}
        tabs={[
          { key: 'tv', label: t('tv') },
          { key: 'table', label: t('table') },
        ]}
      />
      {activeTab === 'tv' && <TVWall />}
      {activeTab === 'table' && <Table />}
    </div>
  );
};

export default TVPage;
