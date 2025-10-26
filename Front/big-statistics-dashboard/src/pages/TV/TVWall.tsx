import React, { useState, useEffect, useRef, useCallback } from 'react';
import TV from './TVTile';
import { AutoDashboard } from './components/AutoDashboard';

type TileId = 'Tv1' | 'Tv2' | 'Tv3' | 'Tv4';

export const TVWall: React.FC = () => {
  const [expanded, setExpanded] = useState<TileId | null>(null);
  const [tileStatus, setTileStatus] = useState<Record<TileId, 'Working' | 'Downtime' | 'Break' | 'Finished' | null>>({
    Tv1: null,
    Tv2: null,
    Tv3: null,
    Tv4: null,
  });
  
  // Refs для вызова функций обновления каждой плитки
  const tileRefs = useRef<Record<TileId, { refresh: () => void } | null>>({
    Tv1: null,
    Tv2: null,
    Tv3: null,
    Tv4: null,
  });

  // поддержка Back: при разворачивании добавляем запись, по popstate сворачиваем
  useEffect(() => {
    const onPop = () => setExpanded(null);
    if (expanded) {
      history.pushState({ tv: expanded }, '');
      window.addEventListener('popstate', onPop);
    }
    return () => window.removeEventListener('popstate', onPop);
  }, [expanded]);

  const tiles: TileId[] = ['Tv1', 'Tv2', 'Tv3', 'Tv4'];

  const gridClass = expanded
    ? 'grid grid-cols-1 gap-4'
    : 'grid grid-cols-1 md:grid-cols-2 gap-4';
  
  // Callback для авто-обновления всех плиток (стабильный с useCallback)
  const handleAutoRefresh = useCallback(() => {
    console.log('🔄 [TVWall] Auto-refresh triggered for all TV tiles');
    tiles.forEach(tileId => {
      if (tileRefs.current[tileId]?.refresh) {
        console.log(`📞 [TVWall] Calling refresh for ${tileId}`);
        tileRefs.current[tileId]!.refresh();
      } else {
        console.warn(`⚠️ [TVWall] No refresh method for ${tileId}`);
      }
    });
  }, []); // Пустой массив зависимостей - callback стабилен

  return (
    <AutoDashboard onAutoRefresh={handleAutoRefresh}>
      <div className={gridClass}>
      {tiles.map((id) => (
        <div
          key={id}
          className={
            expanded && expanded !== id
              ? 'hidden'
              : `cursor-pointer rounded-xl overflow-hidden border-[2px] bg-white ` +
                (tileStatus[id] === 'Downtime'
                  ? 'border-red-300'
                  : tileStatus[id] === 'Break'
                  ? 'border-orange-300'
                  : tileStatus[id] === 'Working'
                  ? 'border-green-300'
                  : 'border-gray-200')
          }
          onClick={(e) => {
            // если клик пришёл из интерактивного элемента внутри — не сворачиваем
            const tag = (e.target as HTMLElement).closest(
              'button,select,input,label,textarea,a,svg,option,div[role="button"],div[role="listbox"],div[role="option"],div[class*="dropdown"],div[class*="picker"],div[class*="menu"],.interactive-element'
            );
            if (tag) return;
            setExpanded(expanded === id ? null : id);
          }}
        >
          {/* Изолированный экземпляр дашборда */}
          <div style={{ zoom: expanded ? 1 : 0.53 }}>
            <TV
              tileId={id}
              isExpanded={!!expanded}
              onStatusChange={(status) => setTileStatus((s) => ({ ...s, [id]: status }))}
              ref={(instance) => {
                if (instance) {
                  tileRefs.current[id] = instance;
                }
              }}
            />
          </div>
        </div>
      ))}
      </div>
    </AutoDashboard>
  );
};


