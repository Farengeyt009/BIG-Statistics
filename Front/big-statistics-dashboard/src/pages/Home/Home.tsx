import React, { useState } from 'react';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { PageLayout, ContentLayout } from '../../components/Layout';
import Production from './Production/Production';
import Dashboard from './Dashboard/Dashboard';
import { usePageView } from '../../hooks/usePageView';
import { useTranslation } from 'react-i18next';

const Home: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { t } = useTranslation('production');
  
  // Логируем посещение страницы Home
  usePageView('home');

  const renderOverviewContent = () => (
    <ContentLayout>
      <div className="flex flex-col items-center justify-center py-12">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-[#0d1c3d] mb-4">
          BIG STATISTICS Working Flow
        </h1>
        <p className="text-xl text-gray-600 mb-8 font-bold">
          Working Plan
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl">
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow relative">
            <span
              className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-green-500 text-white text-xs flex items-center justify-center shadow"
              aria-label="completed"
              title="Completed"
            >
              ✓
            </span>
            <h3 className="text-lg font-semibold text-[#0d1c3d] mb-2">Production 1lv.</h3>
            <p className="text-gray-600 line-through">September-November</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow relative">
            <span
              className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-green-500 text-white text-xs flex items-center justify-center shadow"
              aria-label="completed"
              title="Completed"
            >
              ✓
            </span>
            <h3 className="text-lg font-semibold text-[#0d1c3d] mb-2">Orders 1lv.</h3>
            <p className="text-gray-600 line-through">15 October</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow relative">
            <span
              className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shadow"
              aria-label="in-progress"
              title="In progress"
            >
              ↻
            </span>
            <h3 className="text-lg font-semibold text-[#0d1c3d] mb-2">Planning</h3>
            <p className="text-gray-600">Deadline not set</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mt-6">
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow relative">
            <span
              className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-green-500 text-white text-xs flex items-center justify-center shadow"
              aria-label="completed"
              title="Completed"
            >
              ✓
            </span>
            <span
              className="absolute -top-2 left-5 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shadow"
              aria-label="in-progress"
              title="In progress"
            >
              ↻
            </span>
            <h3 className="text-lg font-semibold text-[#0d1c3d] mb-2">HR & Work Processes</h3>
            <p className="text-gray-600">Deadline not set</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow relative">
            <span
              className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shadow"
              aria-label="in-progress"
              title="In progress"
            >
              ↻
            </span>
            <h3 className="text-lg font-semibold text-[#0d1c3d] mb-2">QC</h3>
            <p className="text-gray-600">February 2026</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold text-[#0d1c3d] mb-2">KPI</h3>
            <p className="text-gray-600">Deadline not set</p>
          </div>
        </div>
        <div className="flex justify-center mt-6">
          <div className="grid grid-cols-2 gap-6 max-w-2xl">
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
              <h3 className="text-lg font-semibold text-[#0d1c3d] mb-2">Interface Translation</h3>
              <p className="text-gray-600">Deadline not set</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
              <h3 className="text-lg font-semibold text-[#0d1c3d] mb-2">Production 2lv.</h3>
              <p className="text-gray-600">Deadline not set</p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </ContentLayout>
  );

  return (
    <PageLayout>
      <PageHeader
        title="Home"
        view={activeTab}
        onViewChange={setActiveTab}
        tabs={[
          { key: 'dashboard', label: 'Month Board' },
          { key: 'production', label: 'Production' },
          { key: 'overview', label: t('workingFlow') },
        ]}
      />
      
      {activeTab === 'overview' && renderOverviewContent()}
      {activeTab === 'dashboard' && <Dashboard />}
      {activeTab === 'production' && <Production />}
    </PageLayout>
  );
};

export default Home; 
