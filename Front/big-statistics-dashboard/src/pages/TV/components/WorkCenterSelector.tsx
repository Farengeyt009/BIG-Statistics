import React, { useState, useRef, useEffect } from 'react';
import { Factory } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface WorkCenter {
  id: string;
  name: string;
  workshopId: string;
  workshopName: string;
}

interface WorkShop {
  id: string;
  name: string;
  workCenters: WorkCenter[];
}

interface WorkCenterSelectorProps {
  workshops: WorkShop[];
  selectedWorkCenter: string;
  onWorkCenterChange: (workCenterId: string) => void;
}

export const WorkCenterSelector: React.FC<WorkCenterSelectorProps> = ({
  workshops,
  selectedWorkCenter,
  onWorkCenterChange,
}) => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredWorkshop, setHoveredWorkshop] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Закрытие dropdown при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHoveredWorkshop(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Очистка таймаута при размонтировании
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Получаем название выбранного РЦ
  const getSelectedWorkCenterName = () => {
    for (const workshop of workshops) {
      const workCenter = workshop.workCenters.find(wc => wc.id === selectedWorkCenter);
      if (workCenter) {
        return workCenter.name;
      }
    }
    return '';
  };

  const handleWorkCenterSelect = (workCenterId: string) => {
    onWorkCenterChange(workCenterId);
    setIsOpen(false);
    setHoveredWorkshop(null);
  };

  const handleDropdownClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Предотвращаем всплытие события
  };

  const handleWorkshopMouseEnter = (workshopId: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setHoveredWorkshop(workshopId);
  };

  const handleWorkshopMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setHoveredWorkshop(null);
    }, 150); // Задержка 150мс для плавного перехода
  };

  const handleSubmenuMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const handleSubmenuMouseLeave = () => {
    setHoveredWorkshop(null);
  };

  return (
         <div className="relative w-full interactive-element" ref={dropdownRef}>
      <Factory className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 z-10" />
      
             {/* Кнопка селектора */}
               <button
          type="button"
          className="w-full rounded-md border border-gray-300 bg-white pl-8 pr-3 py-2 text-sm focus:border-gray-400 focus:ring-1 focus:ring-gray-400 text-left"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
        >
         <span className="font-semibold text-base">
           {getSelectedWorkCenterName() || 'Выберите РЦ'}
         </span>
       </button>

             {/* Dropdown меню */}
       {isOpen && (
                   <div 
            className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 interactive-element"
            onClick={handleDropdownClick}
          >
                     <div className="flex">
                                                     {/* Подменю с РЦ */}
               {hoveredWorkshop && (
                 <div 
                   className="border-r border-gray-200 bg-gray-50 w-fit"
                   onMouseEnter={handleSubmenuMouseEnter}
                   onMouseLeave={handleSubmenuMouseLeave}
                 >
                  {workshops
                    .find(w => w.id === hoveredWorkshop)
                    ?.workCenters.map((workCenter) => (
                      <div
                        key={workCenter.id}
                        className={`px-3 py-2 cursor-pointer hover:bg-blue-100 ${
                          workCenter.id === selectedWorkCenter ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleWorkCenterSelect(workCenter.id);
                        }}
                      >
                                                 <div className="text-sm font-semibold whitespace-nowrap">
                           {workCenter.name}
                         </div>
                      </div>
                    ))}
                </div>
              )}

                          {/* Основной список цехов */}
              <div className="min-w-48">
                {workshops.map((workshop) => (
                  <div
                    key={workshop.id}
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                    onMouseEnter={() => handleWorkshopMouseEnter(workshop.id)}
                    onMouseLeave={handleWorkshopMouseLeave}
                  >
                    <div className="font-medium text-gray-900">
                      {workshop.name}
                    </div>
                                     </div>
                 ))}
               </div>
             </div>
           </div>
         )}
       </div>
     );
   };
