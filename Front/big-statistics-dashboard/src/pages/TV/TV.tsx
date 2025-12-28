import React from 'react';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { PageLayout } from '../../components/Layout';
import { useTranslation } from 'react-i18next';
import { TVWall } from './TVWall';

const TVPage: React.FC = () => {
  const { t } = useTranslation('tv');

  return (
    <PageLayout>
      <PageHeader
        title={t('pageTitle')}
      />
      <TVWall />
    </PageLayout>
  );
};

export default TVPage;
