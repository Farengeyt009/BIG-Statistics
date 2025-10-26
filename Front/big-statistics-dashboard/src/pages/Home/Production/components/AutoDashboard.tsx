import React, { useState, useEffect, useRef } from 'react';
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
    selectedDate,
    pinnedWorkShop,
    setPinnedWorkShop
  } = useProductionContext();

  const [isAutoMode, setIsAutoMode] = useState(false);
  const [currentRowIndex, setCurrentRowIndex] = useState(0);
  const [lastMouseMove, setLastMouseMove] = useState(Date.now());
  
  // Используем ref для хранения актуальных значений
  const isAutoModeRef = useRef(isAutoMode);
  const pinnedWorkShopRef = useRef(pinnedWorkShop);
  const lastMouseMoveRef = useRef(lastMouseMove);
  
  // Обновляем refs при изменении состояний
  useEffect(() => {
    isAutoModeRef.current = isAutoMode;
  }, [isAutoMode]);
  
  useEffect(() => {
    pinnedWorkShopRef.current = pinnedWorkShop;
  }, [pinnedWorkShop]);
  
  useEffect(() => {
    lastMouseMoveRef.current = lastMouseMove;
  }, [lastMouseMove]);

  // Логируем состояние при монтировании
  useEffect(() => {
    console.log('🚀 AutoDashboard mounted (Production)', {
      refreshInterval: `${refreshInterval}ms (${refreshInterval/1000}s)`,
      rowSwitchInterval: `${rowSwitchInterval}ms (${rowSwitchInterval/1000}s)`,
      mouseIdleTime: `${mouseIdleTime}ms (${mouseIdleTime/1000}s)`
    });
  }, [refreshInterval, rowSwitchInterval, mouseIdleTime]);

  // Когда включается авторежим - снимаем закрепление строки
  useEffect(() => {
    if (isAutoMode && pinnedWorkShop) {
      console.log('🔓 Auto mode activated - unpinning row');
      setPinnedWorkShop(null);
    }
  }, [isAutoMode, pinnedWorkShop, setPinnedWorkShop]);

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
    console.log('🔍 Setting up idle time checker (Production)');
    
    const checkIdleTime = () => {
      const idleTime = Date.now() - lastMouseMoveRef.current;
      const idleSeconds = Math.floor(idleTime / 1000);
      
      // Логируем каждые 10 секунд для отладки
      if (idleSeconds % 10 === 0 && idleSeconds > 0 && idleSeconds <= mouseIdleTime / 1000) {
        console.log(`⏱️ Idle for ${idleSeconds}s / ${mouseIdleTime/1000}s (autoMode: ${isAutoModeRef.current}, pinned: ${!!pinnedWorkShopRef.current})`);
      }
      
      // Включаем авторежим при простое (даже если строка закреплена - он её открепит)
      if (idleTime >= mouseIdleTime && !isAutoModeRef.current) {
        console.log('⏰ Mouse idle for 1 minute - starting auto mode');
        setIsAutoMode(true);
      }
    };
    
    const interval = setInterval(checkIdleTime, 1000);
    return () => {
      console.log('🛑 Clearing idle time checker (Production)');
      clearInterval(interval);
    };
  }, [mouseIdleTime]); // Только mouseIdleTime в зависимостях

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
    
    console.log(`✅ Auto mode ACTIVE - setting up refresh interval (Production) (${refreshInterval}ms = ${refreshInterval/1000}s)`);
    
    // Немедленное первое обновление при активации авто-режима
    if (selectedDate) {
      console.log('📞 Initial auto-refresh on activation (Production)');
      fetchProductionData(selectedDate, true);
    }
    
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing data (Production)', { selectedDate });
      if (selectedDate) {
        console.log('📞 Calling fetchProductionData (silent mode)');
        fetchProductionData(selectedDate, true); // silent = true для тихого обновления
      } else {
        console.warn('⚠️ selectedDate is null, skipping refresh');
      }
    }, refreshInterval);
    
    return () => {
      console.log('🛑 Clearing auto-refresh interval (Production)');
      clearInterval(interval);
    };
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