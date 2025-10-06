import React, { useState } from 'react';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import Production from './Production/Production';

const Home: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');

  const renderOverviewContent = () => (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-[#0d1c3d] mb-4">
          Welcome to BIG STATISTICS
        </h1>
        <p className="text-xl text-gray-600 mb-8 font-bold">
          Work Plan
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
            <p className="text-gray-600">September-November</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow relative">
            <span
              className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shadow"
              aria-label="in-progress"
              title="In progress"
            >
              ↻
            </span>
            <h3 className="text-lg font-semibold text-[#0d1c3d] mb-2">Orders</h3>
            <p className="text-gray-600">15 October</p>
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
            <p className="text-gray-600">15 October</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mt-6">
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold text-[#0d1c3d] mb-2">HR & Work Processes</h3>
            <p className="text-gray-600">15 November</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold text-[#0d1c3d] mb-2">QC</h3>
            <p className="text-gray-600">30 November</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold text-[#0d1c3d] mb-2">KPI</h3>
            <p className="text-gray-600">October</p>
          </div>
        </div>
        <div className="flex justify-center mt-6">
          <div className="grid grid-cols-2 gap-6 max-w-2xl">
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
              <h3 className="text-lg font-semibold text-[#0d1c3d] mb-2">Interface Translation</h3>
              <p className="text-gray-600">15 August - 30 December</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
              <h3 className="text-lg font-semibold text-[#0d1c3d] mb-2">Production 2lv.</h3>
              <p className="text-gray-600">December</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4">
      <PageHeader
        title="Home"
        view={activeTab}
        onViewChange={setActiveTab}
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'production', label: 'Production' },
        ]}
      />
      
      {activeTab === 'overview' && renderOverviewContent()}
      {activeTab === 'production' && <Production />}
    </div>
  );
};

export default Home; 
