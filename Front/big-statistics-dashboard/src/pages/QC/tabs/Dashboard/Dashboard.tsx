import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DateRangePickerPro } from '../../../../components/DatePicker';
import DefectCardsDashboard from '../DefectCards/tabs/DefectCardsDashboard/DefectCardsDashboard';

const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(today.getDate() - 30);

const Dashboard: React.FC = () => {
  const { i18n } = useTranslation('qc');
  const currentLanguage = i18n.language as 'en' | 'zh' | 'ru';

  const [startDate, setStartDate] = useState<Date | null>(thirtyDaysAgo);
  const [endDate, setEndDate]     = useState<Date | null>(today);

  const handleDateRangeApply = (from: Date, to?: Date) => {
    setStartDate(from);
    setEndDate(to || from);
  };

  return (
    <div className="p-2 flex flex-col" style={{ minHeight: 0 }}>
      <div className="flex items-center gap-4 mb-3 flex-wrap flex-shrink-0">
        <DateRangePickerPro
          mode="range"
          startDate={startDate}
          endDate={endDate}
          onApply={handleDateRangeApply}
          locale={currentLanguage}
          placeholder="Select date range"
          className="w-64"
        />
      </div>

      <DefectCardsDashboard startDate={startDate} endDate={endDate} />
    </div>
  );
};

export default Dashboard;
