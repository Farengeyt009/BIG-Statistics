import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files
import sidebarTranslation from './components/Sidebar/sidebarTranslation.json';
import ordersTranslation from './pages/Orders/ordersTranslation.json';
import dataTableTranslation from './components/DataTable/dataTableTranslation.json';
import ordersCustomTrainingTranslation from './pages/Orders/utils/CustomTableBuilder/ordersCustomTrainingTranslation.json';
import planTranslation from './pages/Plan/PlanTranslation.json';
import loginPageTranslation from './pages/LoginPage/LoginPageTranslation.json';
import homeInterfaceTranslation from './pages/Home/homeInterfaceTranslation.json';
import productionTranslation from './pages/Production/ProductionTranslation.json';
import tvTranslation from './pages/TV/TVTranslation.json';

const resources = {
  en: {
    sidebar: sidebarTranslation.en,
    ordersTranslation: ordersTranslation.en,
    dataTable: dataTableTranslation.en,
    ordersCustomTrainingTranslation: ordersCustomTrainingTranslation.en,
    planTranslation: planTranslation.en,
    loginPage: loginPageTranslation.en,
    homeInterface: homeInterfaceTranslation.en,
    production: productionTranslation.en,
    tv: tvTranslation.en
  },
  zh: {
    sidebar: sidebarTranslation.zh,
    ordersTranslation: ordersTranslation.zh,
    dataTable: dataTableTranslation.zh,
    ordersCustomTrainingTranslation: ordersCustomTrainingTranslation.zh,
    planTranslation: planTranslation.zh,
    loginPage: loginPageTranslation.zh,
    homeInterface: homeInterfaceTranslation.zh,
    production: productionTranslation.zh,
    tv: tvTranslation.zh
  },
  ru: {
    sidebar: (sidebarTranslation as any).ru || {},
    ordersTranslation: (ordersTranslation as any).ru || {},
    dataTable: (dataTableTranslation as any).ru || {},
    ordersCustomTrainingTranslation: (ordersCustomTrainingTranslation as any).ru || {},
    planTranslation: (planTranslation as any).ru || {},
    loginPage: (loginPageTranslation as any).ru || {},
    homeInterface: (homeInterfaceTranslation as any).ru || {},
    production: productionTranslation.ru,
    tv: (tvTranslation as any).ru || {}
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

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
}); 