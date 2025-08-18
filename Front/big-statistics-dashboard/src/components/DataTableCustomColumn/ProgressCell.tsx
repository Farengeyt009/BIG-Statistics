import React from 'react';

interface ProgressCellProps {
  value: any;
}

const ProgressCell: React.FC<ProgressCellProps> = ({ value }) => {
  const percentNum = Number(String(value).replace(/[^\d.-]/g, ''));
  let barColor = '#93c5fd'; // тусклый синий
  if (percentNum >= 95) barColor = '#86efac'; // тусклый зеленый
  return (
    <div style={{ minWidth: 60, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        height: 18,
        borderRadius: 4,
        background: '#e5e7eb',
        width: '100%',
        marginBottom: 2,
        overflow: 'hidden',
        position: 'absolute',
        left: 0,
        right: 0
      }}>
        <div style={{
          width: `${Math.min(percentNum, 100)}%`,
          background: barColor,
          height: '100%',
          transition: 'width 0.3s'
        }} />
      </div>
      <span style={{
        fontWeight: 500,
        fontSize: 13,
        color: '#111',
        position: 'relative',
        zIndex: 1,
        textAlign: 'center',
        width: '100%'
      }}>
        {value}
      </span>
    </div>
  );
};

export default ProgressCell; 