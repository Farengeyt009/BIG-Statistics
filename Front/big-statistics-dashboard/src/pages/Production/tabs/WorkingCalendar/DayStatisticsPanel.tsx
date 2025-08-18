import React from 'react';
import { useTranslation } from 'react-i18next';
import { DayStatistics } from './mockData';

interface DayStatisticsPanelProps {
  statistics: DayStatistics | null;
  assignmentsCount: number;
  totalPeople: number;
}

const DayStatisticsPanel: React.FC<DayStatisticsPanelProps> = ({
  statistics,
  assignmentsCount,
  totalPeople
}) => {
  const { t } = useTranslation('production');

  if (!statistics) {
    return null;
  }

  // Функция для форматирования чисел с российским разделителем
  const formatNumber = (value: number): string => {
    return Math.round(value).toLocaleString('ru-RU');
  };

  // Функция для определения цвета в зависимости от процента
  const getColorByPercentage = (percentage: number, type: 'good' | 'warning' | 'bad') => {
    if (type === 'good') {
      return percentage >= 95 ? 'text-green-600' : percentage >= 75 ? 'text-yellow-600' : 'text-red-600';
    } else if (type === 'warning') {
      return percentage <= 10 ? 'text-green-600' : percentage <= 25 ? 'text-yellow-600' : 'text-red-600';
    } else {
      return percentage <= 5 ? 'text-green-600' : percentage <= 15 ? 'text-yellow-600' : 'text-red-600';
    }
  };

  // Функция для отрисовки прогресс-бара
  const renderProgressBar = (percentage: number, color: string, bgColor: string) => {
    return (
      <div className="w-full">
        <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className={`h-full ${bgColor} transition-all duration-500 ease-out rounded-full`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-50 border-b border-gray-200 p-4">
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-gray-800">
          {t('statistics.productionOverview')}
        </h3>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Выполнение плана по штукам */}
        <div className="bg-white p-3 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 mb-2">{t('statistics.planCompletionPcs')}</div>
          <div className={`text-2xl font-bold ${getColorByPercentage(statistics.planCompletionpcs, 'good')}`}>
            {Math.round(statistics.planCompletionpcs)}%
          </div>
          {renderProgressBar(
            statistics.planCompletionpcs,
            getColorByPercentage(statistics.planCompletionpcs, 'good'),
            statistics.planCompletionpcs >= 95 ? 'bg-emerald-500' : statistics.planCompletionpcs >= 75 ? 'bg-amber-500' : 'bg-red-500'
          )}
          <div className="text-xs text-gray-500 mt-1">
            {t('statistics.plan')}: {formatNumber(statistics.totalPlanQty)} шт. | {t('statistics.fact')}: {formatNumber(statistics.totalFactQty)} шт.
          </div>
        </div>

        {/* Выполнение плана по часам */}
        <div className="bg-white p-3 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 mb-2">{t('statistics.planCompletionH')}</div>
          <div className={`text-2xl font-bold ${getColorByPercentage(statistics.planCompletionh, 'good')}`}>
            {Math.round(statistics.planCompletionh)}%
          </div>
          {renderProgressBar(
            statistics.planCompletionh,
            getColorByPercentage(statistics.planCompletionh, 'good'),
            statistics.planCompletionh >= 95 ? 'bg-emerald-500' : statistics.planCompletionh >= 75 ? 'bg-amber-500' : 'bg-red-500'
          )}
          <div className="text-xs text-gray-500 mt-1">
            {t('statistics.target')}: 95%
          </div>
        </div>

        {/* Эффективность */}
        <div className="bg-white p-3 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 mb-2">{t('statistics.efficiency')}</div>
          <div className={`text-2xl font-bold ${getColorByPercentage(statistics.efficiency, 'good')}`}>
            {Math.round(statistics.efficiency)}%
          </div>
          {renderProgressBar(
            statistics.efficiency,
            getColorByPercentage(statistics.efficiency, 'good'),
            statistics.efficiency >= 95 ? 'bg-emerald-500' : statistics.efficiency >= 75 ? 'bg-amber-500' : 'bg-red-500'
          )}
          <div className="text-xs text-gray-500 mt-1">
            {t('statistics.target')}: 95%
          </div>
        </div>

        {/* Общие метрики */}
        <div className="bg-white p-3 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 mb-2">{t('assignmentsCount')}</div>
          <div className="text-2xl font-bold text-blue-600">
            {assignmentsCount}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {t('totalPeople')}: {totalPeople}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayStatisticsPanel;
