import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

export default function LanguageSwitcher({ expanded = true }: { expanded?: boolean }) {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  if (!expanded) {
    // В свернутом режиме показываем только неактивную кнопку с анимацией
    return (
      <AnimatePresence mode="wait" initial={false}>
        {i18n.language === 'en' ? (
          <motion.button
            key="zh"
            onClick={() => changeLanguage('zh')}
            className="text-white px-2 py-1 rounded bg-white/10 text-xs font-medium"
            title="中文"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            中文
          </motion.button>
        ) : (
          <motion.button
            key="en"
            onClick={() => changeLanguage('en')}
            className="text-white px-2 py-1 rounded bg-white/10 text-xs font-medium"
            title="English"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            EN
          </motion.button>
        )}
      </AnimatePresence>
    );
  }

  // В развернутом режиме показываем обе кнопки с анимацией
  return (
    <motion.div className="flex items-center gap-2 transition-all" layout>
      <motion.button
        key="en"
        onClick={() => changeLanguage('en')}
        className={`text-white px-2 py-1 rounded ${i18n.language === 'en' ? 'bg-blue-500' : 'bg-white/10'} text-xs font-medium`}
        title="English"
        initial={false}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        EN
      </motion.button>
      <motion.button
        key="zh"
        onClick={() => changeLanguage('zh')}
        className={`text-white px-2 py-1 rounded ${i18n.language === 'zh' ? 'bg-blue-500' : 'bg-white/10'} text-xs font-medium`}
        title="中文"
        initial={false}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        中文
      </motion.button>
    </motion.div>
  );
} 