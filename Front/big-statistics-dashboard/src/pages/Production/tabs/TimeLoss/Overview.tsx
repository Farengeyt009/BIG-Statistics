import React from 'react';
import { useTranslation } from 'react-i18next';

const Overview: React.FC = () => {
  const { t } = useTranslation('production');

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-[#0d1c3d] mb-4">
        {t('statistics.timeLoss')}
      </h2>
      <p className="text-gray-600 mb-4">
        {t('statistics.timeLossDescription')}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-800 mb-2">{t('statistics.plannedDowntime')}</h3>
          <p className="text-sm text-gray-600">{t('statistics.plannedDowntimeDesc')}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-800 mb-2">{t('statistics.unplannedDowntime')}</h3>
          <p className="text-sm text-gray-600">{t('statistics.unplannedDowntimeDesc')}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-800 mb-2">{t('statistics.maintenanceTime')}</h3>
          <p className="text-sm text-gray-600">{t('statistics.maintenanceTimeDesc')}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-800 mb-2">{t('statistics.changeoverTime')}</h3>
          <p className="text-sm text-gray-600">{t('statistics.changeoverTimeDesc')}</p>
        </div>
      </div>
    </div>
  );
};

export default Overview;
