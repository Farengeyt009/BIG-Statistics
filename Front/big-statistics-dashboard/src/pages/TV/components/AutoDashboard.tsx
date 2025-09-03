import React, { useState, useEffect } from 'react';

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
    if (!isAutoMode) return;
    
    const interval = setInterval(() => {
      console.log('🔄 Auto-switching to next row');
      setCurrentRowIndex(prev => (prev + 1) % 10); // Простое переключение для демо
    }, rowSwitchInterval);
    
    return () => clearInterval(interval);
  }, [isAutoMode, rowSwitchInterval]);

  // Автообновление данных
  useEffect(() => {
    if (!isAutoMode) return;
    
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing data');
      // Здесь можно добавить обновление данных
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [isAutoMode, refreshInterval]);

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
