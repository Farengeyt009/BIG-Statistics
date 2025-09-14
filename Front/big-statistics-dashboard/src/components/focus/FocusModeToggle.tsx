import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Variant = 'light' | 'dark';

interface Props {
  variant?: Variant; // light = for dark bg (sidebar); dark = for light bg (toolbars)
}

export default function FocusModeToggle({ variant = 'light' }: Props) {
  const { t } = useTranslation('production');
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('appFocus') === 'true';
  });

  // apply/remove class on body
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('app-focus', enabled);
    localStorage.setItem('appFocus', String(enabled));
  }, [enabled]);

  // ESC to exit
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEnabled(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggle = useCallback(() => setEnabled(v => !v), []);

  const isLight = variant === 'light';
  const btnClass = isLight
    ? `w-8 h-8 rounded-md border border-white/30 flex items-center justify-center hover:bg-white/10 transition ${enabled ? 'bg-white/15' : ''}`
    : `w-8 h-8 rounded-md border border-gray-300 bg-white text-slate-700 flex items-center justify-center hover:bg-gray-100 transition ${enabled ? 'bg-gray-100' : ''}`;

  return (
    <button
      title={enabled ? (t('timeLossTable.focusExit') as string) : (t('timeLossTable.focusEnter') as string)}
      onClick={toggle}
      className={btnClass}
    >
      {/* icon: arrows inward/outward */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isLight ? 'white' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {enabled ? (
          <>
            <polyline points="5 9 5 5 9 5" />
            <polyline points="15 5 19 5 19 9" />
            <polyline points="19 15 19 19 15 19" />
            <polyline points="9 19 5 19 5 15" />
          </>
        ) : (
          <>
            <polyline points="9 5 5 5 5 9" />
            <polyline points="15 5 19 5 19 9" />
            <polyline points="19 15 19 19 15 19" />
            <polyline points="9 19 5 19 5 15" />
          </>
        )}
      </svg>
    </button>
  );
}


