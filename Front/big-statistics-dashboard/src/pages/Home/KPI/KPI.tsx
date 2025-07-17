import React from 'react';

const KPI: React.FC = () => {
  return (
    <div className="py-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">KPI</h2>
        <p className="text-gray-600 mb-8">Ключевые показатели эффективности</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Финансовые показатели</h3>
            <p className="text-gray-600">Анализ финансовых KPI и рентабельности</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Операционные показатели</h3>
            <p className="text-gray-600">Мониторинг операционной эффективности</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Показатели качества</h3>
            <p className="text-gray-600">KPI качества продукции и процессов</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KPI; 