import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files
import sidebarTranslation from './components/Sidebar/sidebarTranslation.json';
import ordersTranslation from './pages/Orders/ordersTranslation.json';
import dataTableTranslation from './components/DataTable/dataTableTranslation.json';

const resources = {
  en: {
    sidebar: sidebarTranslation.en,
    ordersTranslation: ordersTranslation.en,
    dataTable: dataTableTranslation.en
  },
  zh: {
    sidebar: sidebarTranslation.cn,
    ordersTranslation: ordersTranslation.zh,
    dataTable: dataTableTranslation.zh
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already escapes values
    }
  });

export default i18n; 