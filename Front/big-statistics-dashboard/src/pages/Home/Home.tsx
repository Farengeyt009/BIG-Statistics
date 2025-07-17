import React, { useState } from 'react';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import Production from './Production/Production';
import KPI from './KPI/KPI';

const Home: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');

  const renderOverviewContent = () => (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          Добро пожаловать в BIG STATISTICS
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Выберите раздел в боковом меню для начала работы
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl">
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Заказы</h3>
            <p className="text-gray-600">Просмотр и управление заказами клиентов</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Планирование</h3>
            <p className="text-gray-600">Планирование и контроль выполнения планов</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">KPI</h3>
            <p className="text-gray-600">Ключевые показатели эффективности</p>
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
          { key: 'overview', label: 'Обзор' },
          { key: 'production', label: 'Production' },
          { key: 'kpi', label: 'KPI' },
        ]}
      />
      
      {activeTab === 'overview' && renderOverviewContent()}
      {activeTab === 'production' && <Production />}
      {activeTab === 'kpi' && <KPI />}
    </div>
  );
};

export default Home; 