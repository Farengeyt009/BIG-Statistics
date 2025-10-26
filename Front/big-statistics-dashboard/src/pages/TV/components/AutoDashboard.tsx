import React, { useState, useEffect, useRef } from 'react';

interface AutoDashboardProps {
  children: React.ReactNode;
  refreshInterval?: number;    // 60 сек
  mouseIdleTime?: number;     // 60 сек
  onAutoRefresh?: () => void;  // Callback для обновления данных
}

// Создаем контекст для передачи состояния авторежима (для TV - без переключения строк)
const AutoDashboardContext = React.createContext<{
  isAutoMode: boolean;
}>({
  isAutoMode: false
});

export const useAutoDashboard = () => React.useContext(AutoDashboardContext);

export const AutoDashboard = ({ 
  children, 
  refreshInterval = 60000, 
  mouseIdleTime = 60000,
  onAutoRefresh
}: AutoDashboardProps) => {
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [lastMouseMove, setLastMouseMove] = useState(Date.now());
  const onAutoRefreshRef = useRef(onAutoRefresh);
  
  // Обновляем ref при изменении callback
  useEffect(() => {
    onAutoRefreshRef.current = onAutoRefresh;
  }, [onAutoRefresh]);

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
        console.log('⏰ [TV AutoDashboard] Mouse idle for 1 minute - starting auto mode');
        setIsAutoMode(true);
      }
    };
    
    const interval = setInterval(checkIdleTime, 1000);
    return () => clearInterval(interval);
  }, [lastMouseMove, isAutoMode, mouseIdleTime]);

  // Автообновление данных (для TV - без переключения строк)
  useEffect(() => {
    if (!isAutoMode) {
      console.log('❌ [TV AutoDashboard] Auto mode is OFF');
      return;
    }
    
    console.log(`✅ [TV AutoDashboard] Auto mode ACTIVE - setting up refresh interval (${refreshInterval}ms = ${refreshInterval/1000}s)`);
    
    // Немедленное первое обновление при активации авто-режима
    if (onAutoRefreshRef.current) {
      console.log('📞 [TV AutoDashboard] Initial auto-refresh on activation');
      onAutoRefreshRef.current();
    }
    
    const interval = setInterval(() => {
      console.log('🔄 [TV AutoDashboard] Auto-refreshing data (TV) - timer fired');
      if (onAutoRefreshRef.current) {
        console.log('📞 [TV AutoDashboard] Calling onAutoRefresh callback');
        onAutoRefreshRef.current();
      } else {
        console.warn('⚠️ [TV AutoDashboard] onAutoRefresh callback not provided!');
      }
    }, refreshInterval);
    
    return () => {
      console.log('🛑 [TV AutoDashboard] Clearing auto-refresh interval');
      clearInterval(interval);
    };
  }, [isAutoMode, refreshInterval]); // Убрали onAutoRefresh из зависимостей - используем ref

  // Сохранение состояния в localStorage
  useEffect(() => {
    localStorage.setItem('autoDashboard', JSON.stringify({
      isAutoMode,
      lastMouseMove
    }));
  }, [isAutoMode, lastMouseMove]);

  // Восстановление состояния при загрузке
  useEffect(() => {
    const saved = localStorage.getItem('autoDashboard');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        setLastMouseMove(settings.lastMouseMove || Date.now());
      } catch (error) {
        console.error('Error loading auto dashboard settings:', error);
      }
    }
  }, []);

  return (
    <AutoDashboardContext.Provider value={{ isAutoMode }}>
      {children}
    </AutoDashboardContext.Provider>
  );
};
