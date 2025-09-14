import React from 'react';

type Props = {
  on?: boolean;
  title: string;
  onToggle: () => void;
  variant?: 'light' | 'dark';
};

const EditModeToggle: React.FC<Props> = ({ on, title, onToggle, variant = 'light' }) => {
  const isOn = !!on;
  const clsBase = 'h-8 w-8 p-2 rounded-md border flex items-center justify-center';
  const cls = isOn
    ? `${clsBase} ${variant === 'dark' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`
    : `${clsBase} ${variant === 'dark' ? 'bg-white text-blue-600 hover:bg-blue-50' : 'bg-white text-blue-600 hover:bg-blue-50'}`;
  return (
    <button onClick={onToggle} title={title} aria-label={title} className={cls}>
      {/* simple pen icon */}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M3 17.25V21h3.75l11.06-11.06-3.75-3.75L3 17.25Zm17.71-10.04c.39-.39.39-1.02 0-1.41l-2.51-2.51a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 2-1.66Z"/>
      </svg>
    </button>
  );
};

export default EditModeToggle;


