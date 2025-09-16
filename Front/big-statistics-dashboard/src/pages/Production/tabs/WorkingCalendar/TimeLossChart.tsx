import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface TimeLossData {
  workshop: string;
  timeLoss: number;
}

interface TimeLossChartProps {
  data: TimeLossData[];
  maxValue?: number;
}

const TimeLossChart: React.FC<TimeLossChartProps> = ({ data, maxValue }) => {
  const { t } = useTranslation('production');
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="text-xs text-gray-400 text-center py-2">
        {t('noData')}
      </div>
    );
  }

  // Вычисляем максимальное значение для масштабирования
  const calculatedMaxValue = maxValue || Math.max(...data.map(item => item.timeLoss));
  
  // Функция для получения цвета в зависимости от значения
  const getBarColor = (value: number) => {
    if (value === 0) return 'bg-gray-300'; // Серый для нулевых значений
    return 'bg-blue-600'; // Темно-синий для значений больше 0 (как цвет плана)
  };

  // Функция для форматирования чисел
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ru-RU').format(num);
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Область для столбцов */}
      <div className="flex-1 flex items-end justify-center gap-2 px-1 relative">
        {/* Ось Y (невидимая для выравнивания) */}
        <div className="absolute left-0 top-0 bottom-0 w-px bg-transparent" />
        
      {data.map((item, index) => {
        // Простая логика: максимальное значение = 100%, нулевые значения = 100% (серые)
        let height;
        if (item.timeLoss === 0) {
          height = 100; // Серые столбцы (нулевые значения) всегда 100% высоты
        } else {
          height = calculatedMaxValue > 0 ? (item.timeLoss / calculatedMaxValue) * 100 : 0;
        }
          
          return (
            <div
              key={index}
              className="relative flex flex-col items-center justify-end"
              style={{ height: '100%' }}
              onMouseEnter={() => setHoveredBar(index)}
              onMouseLeave={() => setHoveredBar(null)}
            >
              {/* Столбец гистограммы - растет снизу вверх */}
              <div
                className={`w-4 transition-all duration-200 ${getBarColor(item.timeLoss)} ${
                  hoveredBar === index ? 'opacity-80' : 'opacity-100'
                }`}
                style={{ height: `${height}%` }}
              />
              
              {/* Тултип при наведении */}
              {hoveredBar === index && (
                <div className="absolute bottom-full mb-2 bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                  <div className="font-semibold">{item.workshop}</div>
                  <div>{formatNumber(item.timeLoss)} {t('units.hours')}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Ось X внизу */}
      <div className="h-1 border-t border-gray-300">
      </div>
    </div>
  );
};

export default TimeLossChart;
