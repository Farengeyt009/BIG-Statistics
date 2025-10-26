import React from 'react';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { useTranslation } from 'react-i18next';
import { TVWall } from './TVWall';

const TVPage: React.FC = () => {
  const { t } = useTranslation('tv');

  return (
    <div className="p-4">
      <PageHeader
        title={t('pageTitle')}
      />
      <TVWall />
    </div>
  );
};

export default TVPage;
