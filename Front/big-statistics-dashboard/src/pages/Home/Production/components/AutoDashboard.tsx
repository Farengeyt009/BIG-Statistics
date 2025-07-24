import React, { useState, useEffect } from 'react';
import { useProductionContext } from '../ProductionContext';

interface AutoDashboardProps {
  children: React.ReactNode;
  refreshInterval?: number;    // 60 сек
  rowSwitchInterval?: number;  // 10 сек  
  mouseIdleTime?: number;     // 60 сек
}

// Создаем контекст для передачи состояния авторежима
const AutoDashboardContext = React.createContext<{
  isAutoMode: boolean;
  currentRowIndex: number;
}>({
  isAutoMode: false,
  currentRowIndex: 0
});

export const useAutoDashboard = () => React.useContext(AutoDashboardContext);

export const AutoDashboard = ({ 
  children, 
  refreshInterval = 60000, 
  rowSwitchInterval = 10000, 
  mouseIdleTime = 60000 
}: AutoDashboardProps) => {
  const { 
    fetchProductionData, 
    setHoveredWorkShop, 
    workShopRows, 
    selectedDate 
  } = useProductionContext();

  const [isAutoMode, setIsAutoMode] = useState(false);
  const [currentRowIndex, setCurrentRowIndex] = useState(0);
  const [lastMouseMove, setLastMouseMove] = useState(Date.now());

  // Отслеживание движения мыши
  useEffect(() => {
    const handleMouseMove = () => {
      setLastMouseMove(Date.now());
      if (isAutoMode) {
        console.log('🖱️ Mouse moved - stopping auto mode');
        setIsAutoMode(false);
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [isAutoMode]);

  // Проверка неактивности мыши
  useEffect(() => {
    const checkIdleTime = () => {
      const idleTime = Date.now() - lastMouseMove;
      if (idleTime >= mouseIdleTime && !isAutoMode) {
        console.log('⏰ Mouse idle for 1 minute - starting auto mode');
        setIsAutoMode(true);
      }
    };
    
    const interval = setInterval(checkIdleTime, 1000);
    return () => clearInterval(interval);
  }, [lastMouseMove, isAutoMode, mouseIdleTime]);

  // Автопереключение строк
  useEffect(() => {
    if (!isAutoMode || workShopRows.length === 0) return;
    
    const interval = setInterval(() => {
      console.log('🔄 Auto-switching to next row');
      const nextIndex = (currentRowIndex + 1) % workShopRows.length;
      setCurrentRowIndex(nextIndex);
      
      const nextRow = workShopRows[nextIndex];
      if (nextRow) {
        setHoveredWorkShop({
          workShop: nextRow.workShop,
          workCenter: nextRow.workCenter
        });
      }
    }, rowSwitchInterval);
    
    return () => clearInterval(interval);
  }, [isAutoMode, rowSwitchInterval, workShopRows, currentRowIndex, setHoveredWorkShop]);

  // Автообновление данных
  useEffect(() => {
    if (!isAutoMode) return;
    
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing data');
      fetchProductionData(selectedDate);
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [isAutoMode, refreshInterval, selectedDate, fetchProductionData]);

  // Сохранение состояния в localStorage
  useEffect(() => {
    localStorage.setItem('autoDashboard', JSON.stringify({
      isAutoMode,
      currentRowIndex,
      lastMouseMove
    }));
  }, [isAutoMode, currentRowIndex, lastMouseMove]);

  // Восстановление состояния при загрузке
  useEffect(() => {
    const saved = localStorage.getItem('autoDashboard');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        setCurrentRowIndex(settings.currentRowIndex || 0);
        setLastMouseMove(settings.lastMouseMove || Date.now());
      } catch (error) {
        console.error('Error loading auto dashboard settings:', error);
      }
    }
  }, []);

  return (
    <AutoDashboardContext.Provider value={{ isAutoMode, currentRowIndex }}>
      {children}
    </AutoDashboardContext.Provider>
  );
}; 