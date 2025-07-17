import React, { useEffect, useState } from 'react';

interface StatisticalCardProps {
  /** «34 %» — крупный заголовок */
  headline: string;
  /** подпись под процентом («Total plan, psc») */
  subtext: string;
  /** числитель KPI */
  numerator: number;
  /** знаменатель KPI */
  denominator: number;
  /** факт‑план в процентах, 0 – 100 */
  percentage: number;
  colors?: {
    plan: string;
    fact: string;
    axis?: string;
  };
}

/**
 * Карточка с KPI и компактной горизонтальной гистограммой «План / Факт».
 *
 * ┌─────────────────────────────┐
 * │   34 %                      │
 * │   Total plan, psc           │
 * │ ┌──── text ────┬─ chart ──┐ │
 * │ └──────────────────────────┘
 * └─────────────────────────────┘
 */
const StatisticalCard: React.FC<StatisticalCardProps> = ({
  headline,
  subtext,
  numerator,
  denominator,
  percentage,
  colors
}) => {
  /* ---------- Анимация процента ---------- */
  const [animatedPercentage, setAnimatedPercentage] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - start) / 300, 1);        // 300 мс
      const eased    = 1 - Math.pow(1 - progress, 3);           // ease‑out‑cubic
      setAnimatedPercentage(percentage * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [percentage]);

  /* ---------- Геометрия графика ---------- */
  // Цвета с возможностью переопределения
  const {
    plan: planColor = '#0d1c3d',
    fact: factColor = '#10B981',
    axis: axisColor = '#6B7280',
  } = colors || {};

  // Геометрия круговой диаграммы
  const cx = 30, cy = 30, r = 25;
  const angle = (animatedPercentage / 100) * 2 * Math.PI;
  const x = cx + r * Math.cos(angle - Math.PI / 2);
  const y = cy + r * Math.sin(angle - Math.PI / 2);
  const largeArc = animatedPercentage > 50 ? 1 : 0;

  /* ---------- Render ---------- */
  return (
         <div
       style={{
         display: 'flex',
         flexDirection: 'column',
         alignItems: 'flex-start',
         padding: 20,
         background: '#fff',
         borderRadius: 12,
         boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
         minWidth: 200,
         minHeight: 160
       }}
     >
      {/* headline  */}
      <div style={{ position: 'relative', marginBottom: 4, width: '100%' }}>
        <div style={{ fontWeight: 700, fontSize: '1.5rem', lineHeight: 1 }}>
          {headline}
        </div>
        <div style={{
          position: 'absolute',
          right: 0,
          top: 0,
          fontWeight: 500,
          fontSize: '0.85rem',
          color: numerator - denominator >= 0 ? '#8BC34A' : '#E57373',
          opacity: 0.8
                  }}>
            {numerator - denominator > 0 ? '+' : ''}{Math.round(numerator - denominator).toLocaleString('en-US')}
          </div>
      </div>
      {/* subtext */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: '1rem', color: axisColor }}>
          {subtext}
        </div>
      </div>
      {/* content row */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 20,
          width: '100%'
        }}
      >
        {/* числитель / знаменатель */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 2, color: axisColor }}>
            {Math.round(numerator).toLocaleString('en-US')}
          </div>
          <svg
            width={60}
            height={2}
            style={{ display: 'block', margin: '0 auto 2px' }}
          >
            <line
              x1={0}
              y1={1}
              x2={60}
              y2={1}
              stroke={axisColor}
              strokeWidth={1}
            />
          </svg>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: axisColor }}>
            {Math.round(denominator).toLocaleString('en-US')}
          </div>
        </div>
        {/* круговая диаграмма */}
        <svg
          width={60}
          height={60}
          style={{ flexShrink: 0 }}
        >
          {/* центр круга */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={axisColor}
            strokeWidth={1}
          />
          {/* сектор факта */}
          {animatedPercentage > 0 && animatedPercentage < 100 && (
            <path
              d={`M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${x} ${y} Z`}
              fill={factColor}
            />
          )}
          {/* при 100% — полный круг факта */}
          {animatedPercentage === 100 && (
            <circle cx={cx} cy={cy} r={r} fill={factColor} />
          )}
          {/* сектор плана (оставшаяся часть) */}
          {animatedPercentage < 100 && (
            <path
              d={`M ${cx} ${cy} L ${x} ${y} A ${r} ${r} 0 ${largeArc} 0 ${cx} ${cy - r} Z`}
              fill={planColor}
            />
          )}
        </svg>
      </div>
    </div>
  );
};

export default StatisticalCard;
