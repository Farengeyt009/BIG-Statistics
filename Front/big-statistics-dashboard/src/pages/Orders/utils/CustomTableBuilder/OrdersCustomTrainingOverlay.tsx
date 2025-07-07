// pages/Orders/utils/OrdersCustomTrainingOverlay.tsx
import { useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';

interface Props {
  anchorRef: React.RefObject<HTMLElement | null>;
  visible: boolean;
}

export default function OrdersCustomTrainingOverlay({ anchorRef, visible }: Props) {
  const { t } = useTranslation('ordersCustomTrainingTranslation');
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    function recalc() {
      if (!anchorRef.current) return;
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    }
    recalc();
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, [anchorRef]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-40">
      {/* плашка */}
      <div
        id="custom-help-card"
        className="relative bg-gray-15 text-gray-700 rounded-lg p-8 shadow-lg max-w-lg text-center border border-[#0d1c3d]"
      >
        <h2 className="text-lg font-semibold mb-2">{t('title')}</h2>
        <div className="text-sm whitespace-pre-line text-left">
          <ReactMarkdown>{t('message')}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
