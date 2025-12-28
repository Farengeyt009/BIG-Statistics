import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ContentLayout } from '../../../components/Layout';
import OrdersStatistics from './StatisticsOrders/OrdersStatistics';
import OrdersLog from './OrdersLog/OrdersLog';

export default function OrderData() {
  const [activeSubtab, setActiveSubtab] = useState<'statistics' | 'log'>('statistics');
  const { t } = useTranslation('ordersTranslation');
  
  // Для Order Log - управление отчетами (передаём в OrdersLog)
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  return (
    <ContentLayout>
      <div className="flex items-center gap-6 mb-3">
        {/* Подвкладки */}
        <div className="flex gap-2">
          <button
            className={`px-4 py-1 rounded-md text-sm font-medium border transition-colors ${
              activeSubtab === 'statistics'
                ? 'bg-[#0d1c3d] text-white border-[#0d1c3d]'
                : 'bg-gray-100 text-gray-700 border-gray-300'
            }`}
            onClick={() => setActiveSubtab('statistics')}
          >
            Uncompleted Orders
          </button>
          <button
            className={`px-4 py-1 rounded-md text-sm font-medium border transition-colors ${
              activeSubtab === 'log'
                ? 'bg-[#0d1c3d] text-white border-[#0d1c3d]'
                : 'bg-gray-100 text-gray-700 border-gray-300'
            }`}
            onClick={() => setActiveSubtab('log')}
          >
            {t('orderData.orderLog')}
          </button>
        </div>

        {/* Селектор отчетов для Order Log - сразу после подвкладок */}
        {activeSubtab === 'log' && (
          <div className="flex items-center gap-2">
            <div id="orderlog-report-selector" className="flex items-center gap-2" />
          </div>
        )}

        {/* Кнопка управления отчетами справа */}
        {activeSubtab === 'log' && (
          <div className="ml-auto">
            <div id="orderlog-manage-button" />
          </div>
        )}
      </div>

      {/* Контент вкладок */}
      {activeSubtab === 'statistics' && (
        <OrdersStatistics />
      )}

      {activeSubtab === 'log' && (
        <OrdersLog 
          selectedReportId={selectedReportId}
          setSelectedReportId={setSelectedReportId}
          isManagerOpen={isManagerOpen}
          setIsManagerOpen={setIsManagerOpen}
        />
      )}
    </ContentLayout>
  );
}

