import React from 'react';
import StatisticalCard from '../../../../../components/StatisticalCard';

interface RawDataItem {
  day: number;
  plan: number;
  fact: number;
}

interface StatisticalCardContainerProps {
  rawData: RawDataItem[];
  headline: string;
  subtext: string;
}

const StatisticalCardContainer: React.FC<StatisticalCardContainerProps> = ({
  rawData,
  headline,
  subtext
}) => {
  // Расчёты из сырых данных
  const totalFact = rawData.reduce((sum, item) => sum + item.fact, 0);
  const totalPlan = rawData.reduce((sum, item) => sum + item.plan, 0);
  const percentage = totalPlan > 0 ? (totalFact / totalPlan) * 100 : 0;

  return (
    <StatisticalCard
      headline={headline}
      subtext={subtext}
      numerator={totalFact}
      denominator={totalPlan}
      percentage={percentage}
    />
  );
};

export default StatisticalCardContainer; 