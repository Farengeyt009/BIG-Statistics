import React from 'react';
import { CalendarDayData } from './types';



interface DayCellProps {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  calendarData: CalendarDayData[];
  loading: boolean;
}



const DayCell: React.FC<DayCellProps> = ({ 
  date, 
  isCurrentMonth, 
  isToday, 
  isSelected = false,
  onClick,
  calendarData,
  loading
}) => {
  const dayNumber = date.getDate();
  
  // Функция для получения данных дня из API
  const getDayData = (date: Date): CalendarDayData | null => {
    if (!calendarData || calendarData.length === 0) return null;
    
    // Форматируем дату в формат DD.MM.YYYY для поиска
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const dateString = `${day}.${month}.${year}`;
    
    return calendarData.find(item => item.OnlyDate === dateString) || null;
  };
  
  const dayData = getDayData(date);
  

  


  // ✅ Цветовая схема для эффективности
  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency < 75) {
      return 'bg-red-100 text-red-800';
    } else if (efficiency < 95) {
      return 'bg-orange-100 text-orange-800';
    } else {
      return 'bg-green-100 text-green-800';
    }
  };

  // ✅ Функция для форматирования чисел с русским разделителем
  const formatNumber = (num: number): string => {
    return Math.round(num).toLocaleString('ru-RU');
  };



  // ✅ Функция для расчета расхождения с реальными данными из API
  const calculateDiscrepancy = (dayData: CalendarDayData | null): string | null => {
    if (!dayData) return null;
    
    // Расчетное значение Time Loss
    const calculatedLoss = dayData.Shift_Time - dayData.Prod_Time;
    
    // Расхождение между реальным Time_Loss из API и расчетным
    const discrepancy = dayData.Time_Loss - calculatedLoss;
    
    if (Math.round(discrepancy) === 0) {
      return null; // не показываем если расхождение = 0
    }
    
    return `${discrepancy > 0 ? '+' : ''}${Math.round(discrepancy)}`;
  };

  return (
    <div
      onClick={onClick}
      className={`
        min-h-[120px] p-3 border-t cursor-pointer
        transition-all duration-200 hover:bg-gray-50 relative
        ${!isCurrentMonth ? 'bg-gray-50 text-gray-400 border-black' : 'bg-white border-black'}
        ${isToday ? 'bg-orange-50 border-orange-500' : ''}
        ${isSelected ? 'ring-2 ring-blue-500' : ''}
      `}
    >
             {/* Date number and People */}
       <div className="flex justify-between items-start mb-2">
         <div className={`
           text-2xl font-bold
           ${isToday ? 'text-orange-600' : isCurrentMonth ? 'text-gray-600' : 'text-gray-400'}
         `}>
           {dayNumber.toString().padStart(2, '0')}
         </div>
         
                   {isCurrentMonth && (() => {
            const discrepancy = calculateDiscrepancy(dayData);
            return discrepancy && (
              <div className="text-xs text-gray-600">
                {discrepancy}
              </div>
            );
          })()}
       </div>

                                                       {/* Данные из API */}
         {isCurrentMonth && !loading && dayData && (
           <div className="space-y-1">
             {/* Реальные данные из API */}
             <div className={`text-xs px-1 py-0.5 rounded ${getEfficiencyColor(dayData.Prod_Time / dayData.Shift_Time * 100)} flex justify-between items-center`}>
               <span>Effic.: {Math.round(dayData.Prod_Time / dayData.Shift_Time * 100)}%</span>
               <span>People: {formatNumber(dayData.People)}</span>
             </div>
             
             {/* Дополнительные данные */}
             <div className="text-[12px] space-y-0.5">
               <div className="text-gray-600">Prod. Time: {formatNumber(dayData.Prod_Time)}</div>
               <div className="text-gray-600">Shift Time: {formatNumber(dayData.Shift_Time)}</div>
               <div className="text-gray-600">Time Loss: {formatNumber(dayData.Time_Loss)}</div>
             </div>
           </div>
         )}
         
         {/* Индикатор загрузки */}
         {isCurrentMonth && loading && (
           <div className="text-xs text-gray-500">Loading...</div>
         )}
    </div>
  );
};

export default DayCell;
