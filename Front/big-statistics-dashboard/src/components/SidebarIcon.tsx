import { ReactElement, useContext, useEffect } from "react";
import {
  motion,
  useTransform,
  useMotionValue,
  animate,
  AnimatePresence,
} from "framer-motion";
import { SidebarWidthCtx } from "./Sidebar";

type SidebarIconProps = {
  icon: ReactElement;
  label: string;
  isActive?: boolean;
  shiftIcons: boolean;
  showLabel: boolean;
  onShiftEnd: () => void;
  staticCenter?: boolean;
  isCollapsed: boolean;
};

/* --- настройки --- */
const ICON_HALF = 12;   // 24 / 2
const LEFT_PAD = 8;     // «один пробел» ≈ 8 px от левого края

export function SidebarIcon({
  icon,
  label,
  isActive = false,
  shiftIcons,
  showLabel,
  onShiftEnd,
  staticCenter = false,
  isCollapsed,
}: SidebarIconProps) {
  /* ширина сайдбара → центр иконки */
  const widthMV = useContext(SidebarWidthCtx)!;
  const centerX = useTransform(widthMV, (w) => w / 2 - ICON_HALF);

  /* единый MotionValue, который живёт в style */
  const xMV = useMotionValue(centerX.get());

  /* --- синхронизация и анимация --- */
  if (!staticCenter) {
    useEffect(() => {
      if (!shiftIcons) {
        /* фаза-1: всегда держим xMV = центр */
        const unsub = centerX.on("change", (latest) => xMV.set(latest));
        return unsub; // отписка
      }

      /* фаза-2: плавно едем влево */
      const controls = animate(xMV, LEFT_PAD, {
        duration: 0.6,
        ease: [0.42, 0, 0.58, 1],
        onComplete: onShiftEnd,
      });
      return controls.stop;
    }, [shiftIcons, centerX, xMV, onShiftEnd]);
  }

  return (
    <motion.div
      layout
      whileHover={!staticCenter ? { backgroundColor: "rgba(255,255,255,0.10)" } : undefined}
      transition={{ duration: 0.18 }}
      className="group w-full flex items-center rounded-xl cursor-pointer py-3 relative mx-0"
    >
      {/* вертикальная полоска «активен» */}
      {isActive && (
        <motion.div
          layoutId="sidebarActive"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r"
        />
      )}

      {/* сама иконка */}
      <motion.div
        /* staticCenter 👉 всегда держим центр, но без анимации влево */
        style={staticCenter
          ? { x: centerX, height: 24 }
          : { x: xMV, height: 24 }}
        className="w-6 flex-shrink-0 flex items-center justify-start"
        whileHover={!staticCenter ? { scale: 1.1 } : undefined}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {icon}
      </motion.div>

      {/* tooltip — показываем ТОЛЬКО когда сайдбар узкий */}
      {!staticCenter && isCollapsed && (
        <span
          className="absolute left-full ml-3 py-1 px-2 rounded bg-white text-[#0d1c3d] text-xs font-medium shadow-lg whitespace-nowrap opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all duration-150"
        >
          {label}
        </span>
      )}

      {/* подпись появляется только после сдвига иконок */}
      <AnimatePresence>
        {showLabel && (
          <motion.span
            key="label"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.25 }}
            className="ml-3 text-white text-sm font-medium"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
