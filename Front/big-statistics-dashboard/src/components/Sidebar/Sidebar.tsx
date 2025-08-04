import {
    Home,
    ShoppingCart,
    Calendar,
    LineChart,
    Factory,
    CircleCheckBig,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { SidebarIcon } from "./SidebarIcon";
import {
    motion,
    AnimatePresence,
    useMotionValue,
    useSpring,
    animate,
    type MotionValue,
} from "framer-motion";
import {
    createContext,
    useState,
    useEffect,
    PropsWithChildren,
    useRef,
} from "react";
import LanguageSwitcher from "../LanguageSwitcher";
import { useTranslation } from 'react-i18next';
import { Link } from "react-router-dom";

import chart from "../../assets/chart.png";
import logo from "../../assets/logo_big_statistics.png";

export const SidebarWidthCtx = createContext<MotionValue<number> | null>(null);

const COLLAPSED = 60;
const EXPANDED = 120;

type SidebarProps = {
    expanded: boolean;
    toggleSidebar: () => void;
};

export default function Sidebar({ expanded, toggleSidebar }: SidebarProps) {
    const { t } = useTranslation('sidebar');
    const iconClass = "w-5 h-5 text-white";
    const [sidebarFullyExpanded, setSidebarFullyExpanded] = useState(expanded);
    const [iconsFullyShifted, setIconsFullyShifted] = useState(expanded);
    const [avatarHovered, setAvatarHovered] = useState(false);
    const [avatarPopoverOpen, setAvatarPopoverOpen] = useState(false);
    const popoverTimeout = useRef<NodeJS.Timeout | null>(null);
    const user = typeof window !== 'undefined' ? (localStorage.getItem('user') || '') : '';
    const avatarSrc = user ? `/avatar_${user.toLowerCase()}.png` : '/avatar.png';

    const widthMV = useMotionValue(expanded ? EXPANDED : COLLAPSED);
    const widthSpring = useSpring(widthMV, { stiffness: 260, damping: 30 });
    const isCollapsed = !expanded;
    const firstRender = useRef(true);

    const showText = expanded && iconsFullyShifted;

    useEffect(() => {
        setSidebarFullyExpanded(false);
        setIconsFullyShifted(false);
    }, [expanded]);

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        animate(widthMV, expanded ? EXPANDED : COLLAPSED, {
            duration: 0.4,
            ease: "easeInOut",
            onComplete: handleSidebarAnimationComplete,
        });
    }, [expanded]);

    function handleSidebarAnimationComplete() {
        if (expanded) {
            setSidebarFullyExpanded(true);
        }
    }
    function handleIconsAnimationComplete() {
        if (sidebarFullyExpanded) {
            setIconsFullyShifted(true);
        }
    }

    return (
        <SidebarWidthCtx.Provider value={widthSpring}>
            <motion.div
                style={{ width: widthSpring }}
                className="h-screen bg-[#0d1c3d] flex flex-col overflow-visible relative"
            >
                {/* 🔷 Логотип */}
                <motion.div
                    layout
                    className={`w-full flex flex-col items-center justify-center px-2 ${
                        expanded ? "mt-4 h-[100px]" : "h-[64px]"
                    }`}
                >
                    <div className="flex flex-col items-center gap-y-[4px]">
                        <AnimatePresence mode="wait">
                            {expanded ? (
                                <motion.img
                                    key="logo_full"
                                    src={logo}
                                    alt="BIG STATISTICS"
                                    initial={{ opacity: 0, y: 8, scale: 0.9, rotateZ: 90 }}
                                    animate={{ opacity: 1, y: 0, scale: 1, rotateZ: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, rotateZ: -45 }}
                                    transition={{
                                        duration: 0.6,
                                        ease: "easeOut",
                                        rotateZ: { type: "spring", stiffness: 150, damping: 14 },
                                        scale: { type: "spring", stiffness: 250, damping: 20 },
                                    }}
                                    className="h-[72px] object-contain"
                                />
                            ) : (
                                <motion.img
                                    key="logo_chart_only"
                                    src={chart}
                                    alt="Chart"
                                    initial={{ opacity: 0, scale: 0.9, y: -2 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: -2 }}
                                    transition={{ duration: 0.4, ease: "easeOut" }}
                                    className="h-8 object-contain relative top-[2px]"
                                />
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>

                {/* ⬅ Стрелка между логотипом и иконками */}
                <button
                    onClick={toggleSidebar}
                    className={`absolute right-[-8px] z-50 bg-[#0d1c3d] border border-white/20 
                    hover:bg-white/10 p-1 rounded-full transition
                    ${expanded ? "top-[105px]" : "top-[60px]"}`}
                >
                    {expanded ? (
                        <ChevronLeft className="w-4 h-4 text-white" />
                    ) : (
                        <ChevronRight className="w-4 h-4 text-white" />
                    )}
                </button>

                {/* 🔹 Иконки */}
                <div className="flex flex-col mt-4 space-y-2 w-full">
                    {(() => {
                        return (
                            <>
                                <Link to="/" className="block">
                                    <SidebarIcon icon={<Home className={iconClass} />} label={t('home')} shiftIcons={sidebarFullyExpanded} showLabel={showText} onShiftEnd={handleIconsAnimationComplete} isCollapsed={isCollapsed} />
                                </Link>
                                <Link to="/uncompleted-orders" className="block">
                                    <SidebarIcon icon={<ShoppingCart className={iconClass} />} label={t('orders')} shiftIcons={sidebarFullyExpanded} showLabel={showText} onShiftEnd={handleIconsAnimationComplete} isCollapsed={isCollapsed} />
                                </Link>
                                <Link to="/plan" className="block">
                                    <SidebarIcon icon={<Calendar className={iconClass} />} label={t('plan')} shiftIcons={sidebarFullyExpanded} showLabel={showText} onShiftEnd={handleIconsAnimationComplete} isCollapsed={isCollapsed} />
                                </Link>
                                <Link to="/kpi" className="block">
                                    <SidebarIcon icon={<LineChart className={iconClass} />} label={t('kpi')} shiftIcons={sidebarFullyExpanded} showLabel={showText} onShiftEnd={handleIconsAnimationComplete} isCollapsed={isCollapsed} />
                                </Link>
                                <Link to="/production" className="block">
                                    <SidebarIcon icon={<Factory className={iconClass} />} label={t('mes')} shiftIcons={sidebarFullyExpanded} showLabel={showText} onShiftEnd={handleIconsAnimationComplete} isCollapsed={isCollapsed} />
                                </Link>
                                <Link to="/tasks" className="block">
                                    <SidebarIcon icon={<CircleCheckBig className={iconClass} />} label={t('tasks')} shiftIcons={sidebarFullyExpanded} showLabel={showText} onShiftEnd={handleIconsAnimationComplete} isCollapsed={isCollapsed} />
                                </Link>
                            </>
                        );
                    })()}
                </div>

                {/* 🔽 Нижняя часть — уведомления и аватар */}
                <div className="flex flex-col items-center mt-auto mb-4 gap-4">
                  {/* колокольчик: всегда по центру, без анимаций */}
                  <div className="w-6 h-6 flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 h-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      />
                    </svg>
                  </div>
                  {/* аватар + popover */}
                  <div
                    className="relative"
                    onMouseEnter={() => {
                      if (popoverTimeout.current) clearTimeout(popoverTimeout.current);
                      setAvatarPopoverOpen(true);
                    }}
                    onMouseLeave={() => {
                      popoverTimeout.current = setTimeout(() => setAvatarPopoverOpen(false), 200);
                    }}
                  >
                    <div className="w-12 h-12 rounded-full bg-white/20 border-2 border-white flex items-center justify-center cursor-pointer">
                      <img
                        src={avatarSrc}
                        alt="User"
                        className="w-10 h-10 rounded-full object-cover"
                        onError={(e) => { e.currentTarget.src = "/avatar.png"; }}
                      />
                    </div>
                    {avatarPopoverOpen && (
                      <div
                        className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 min-w-[160px] bg-white text-[#142143] rounded-lg shadow-lg p-4 flex flex-col items-center animate-fade-in border border-[#142143]"
                        onMouseEnter={() => {
                          if (popoverTimeout.current) clearTimeout(popoverTimeout.current);
                          setAvatarPopoverOpen(true);
                        }}
                        onMouseLeave={() => {
                          popoverTimeout.current = setTimeout(() => setAvatarPopoverOpen(false), 200);
                        }}
                      >
                        <div className="font-semibold mb-2">{user || "User"}</div>
                        <button
                          onClick={() => {
                            localStorage.removeItem("isAuth");
                            localStorage.removeItem("user");
                            window.location.href = "/login";
                          }}
                          className="text-red-600 hover:underline text-sm"
                        >
                          Выйти
                        </button>
                      </div>
                    )}
                  </div>
                  {/* переключатель языка */}
                  <div className="mt-4 w-full flex justify-center">
                    <LanguageSwitcher expanded={expanded} />
                  </div>
                </div>
            </motion.div>
        </SidebarWidthCtx.Provider>
    );
}
