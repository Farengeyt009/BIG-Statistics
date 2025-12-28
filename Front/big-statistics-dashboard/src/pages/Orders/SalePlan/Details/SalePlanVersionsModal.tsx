import React, { useState, useEffect, useMemo } from 'react';
import { X, FileText, Calendar, User, Hash, FileSpreadsheet, ChevronRight, ChevronDown, Trash2, CheckCircle } from 'lucide-react';
import ExportSalePlanButton from '../../../../components/AgGrid/ExportSalePlanButton';

interface Version {
  VersionID: number;
  UploadedAt: string;
  UploadedBy: string;
  MinYear: number;
  MaxYear: number;
  TotalRecords: number;
  FileName: string;
  Comment: string | null;
  IsActive: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function SalePlanVersionsModal({ isOpen, onClose }: Props) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Загрузка списка версий
  useEffect(() => {
    if (!isOpen) return;

    const loadVersions = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/orders/saleplan/versions');
        const data = await response.json();
        
        if (data.success) {
          setVersions(data.versions);
        }
      } catch (err) {
        console.error('Ошибка загрузки версий:', err);
      } finally {
        setLoading(false);
      }
    };

    loadVersions();
  }, [isOpen]);

  // Группируем версии по годам
  const versionsByYear = useMemo(() => {
    const grouped: Record<number, Version[]> = {};
    
    versions.forEach(v => {
      const year = v.MinYear;
      if (!grouped[year]) {
        grouped[year] = [];
      }
      grouped[year].push(v);
    });
    
    // Сортируем по убыванию года
    return Object.entries(grouped)
      .sort(([yearA], [yearB]) => Number(yearB) - Number(yearA))
      .map(([year, versions]) => ({
        year: Number(year),
        versions: versions.sort((a, b) => b.VersionID - a.VersionID), // Новые версии вверху
      }));
  }, [versions]);

  const toggleYear = (year: number) => {
    setExpandedYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  };

  // Загрузка аналитики при выборе версии
  const loadAnalytics = async (versionId: number) => {
    setAnalyticsLoading(true);
    setAnalytics(null);
    try {
      const response = await fetch(`/api/orders/saleplan/versions/${versionId}/analytics`);
      const data = await response.json();
      
      if (data.success) {
        setAnalytics(data);
      }
    } catch (err) {
      console.error('Ошибка загрузки аналитики:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleSelectVersion = (version: Version) => {
    setSelectedVersion(version);
    loadAnalytics(version.VersionID);
  };

  const handleSetActive = async () => {
    if (!selectedVersion) return;
    
    setActionLoading(true);
    try {
      const response = await fetch(`/api/orders/saleplan/versions/${selectedVersion.VersionID}/set-active`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Перезагружаем список версий
        const reloadResponse = await fetch('/api/orders/saleplan/versions');
        const reloadData = await reloadResponse.json();
        if (reloadData.success) {
          setVersions(reloadData.versions);
          // Обновляем selectedVersion
          const updated = reloadData.versions.find((v: Version) => v.VersionID === selectedVersion.VersionID);
          if (updated) setSelectedVersion(updated);
        }
      } else {
        alert(`Ошибка: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedVersion) return;
    
    if (!confirm(`Удалить версию ${selectedVersion.VersionID}? Это действие нельзя отменить.`)) {
      return;
    }
    
    setActionLoading(true);
    try {
      const response = await fetch(`/api/orders/saleplan/versions/${selectedVersion.VersionID}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Перезагружаем список версий
        const reloadResponse = await fetch('/api/orders/saleplan/versions');
        const reloadData = await reloadResponse.json();
        if (reloadData.success) {
          setVersions(reloadData.versions);
          setSelectedVersion(null);
        }
      } else {
        alert(`Ошибка: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Ошибка: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    
    try {
      // Парсим дату (GMT формат)
      const date = new Date(dateStr);
      
      if (isNaN(date.getTime())) {
        return dateStr;
      }
      
      // Используем UTC методы чтобы избежать конвертации часового пояса
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const hour = String(date.getUTCHours()).padStart(2, '0');
      const minute = String(date.getUTCMinutes()).padStart(2, '0');
      
      return `${year}.${month}.${day} ${hour}:${minute}`;
    } catch (err) {
      console.error('Date formatting error:', err, dateStr);
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[90vw] max-w-[1200px] h-[85vh] overflow-hidden flex flex-col">
        {/* Заголовок */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-white">
          <h2 className="text-2xl font-bold text-[#142143]">Sale Plan Versions</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Контент: две панели */}
        <div className="flex flex-1 overflow-hidden">
          {/* ЛЕВАЯ ПАНЕЛЬ: Список версий с группировкой по годам */}
          <div className="w-80 border-r flex flex-col bg-gray-50">
            {/* Список версий */}
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : versionsByYear.length === 0 ? (
                <div className="text-center text-gray-500 py-8 text-sm">
                  Нет загруженных версий
                </div>
              ) : (
                <div className="space-y-1">
                  {versionsByYear.map(({ year, versions: yearVersions }) => (
                    <div key={year}>
                      {/* Заголовок года */}
                      <div
                        onClick={() => toggleYear(year)}
                        className="flex items-center gap-2 p-3 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition mb-1"
                      >
                        {expandedYears.has(year) ? (
                          <ChevronDown className="w-4 h-4 text-gray-600" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-600" />
                        )}
                        <span className="font-semibold text-gray-900">{year}</span>
                        <span className="ml-auto text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {yearVersions.length}
                        </span>
                      </div>

                      {/* Версии этого года */}
                      {expandedYears.has(year) && (
                        <div className="ml-4 space-y-2 mb-2">
                          {yearVersions.map((version) => (
                            <div
                              key={version.VersionID}
                              onClick={() => handleSelectVersion(version)}
                              className={`p-3 rounded-lg cursor-pointer transition-all ${
                                selectedVersion?.VersionID === version.VersionID
                                  ? 'bg-blue-100 border-2 border-blue-500 shadow-sm'
                                  : 'bg-white border border-gray-200 hover:border-blue-300 hover:shadow'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-1">
                                <span className="font-medium text-sm text-gray-900">
                                  v{version.VersionID % 1000}
                                </span>
                                {version.IsActive && (
                                  <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-600 space-y-0.5">
                                <div>{formatDate(version.UploadedAt)}</div>
                                <div className="truncate text-gray-500">{version.TotalRecords} записей</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ПРАВАЯ ПАНЕЛЬ: Детали версии */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            {selectedVersion ? (
              <>
                <div className="p-6 border-b">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-gray-900">
                      Version {selectedVersion.VersionID}
                    </h3>
                    {/* Иконки действий */}
                    <div className="flex items-center gap-2">
                      <ExportSalePlanButton 
                        versionId={selectedVersion.VersionID} 
                        fileName={`sale_plan_${selectedVersion.VersionID}`} 
                      />
                      {!selectedVersion.IsActive && (
                        <button
                          onClick={handleSetActive}
                          disabled={actionLoading}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Сделать активной"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={handleDelete}
                        disabled={actionLoading}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Удалить версию"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Информация о версии */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-start gap-3">
                        <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Загружен</div>
                          <div className="text-sm font-medium text-gray-900">
                            {formatDate(selectedVersion.UploadedAt)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Период</div>
                          <div className="text-sm font-medium text-gray-900">
                            {selectedVersion.MinYear === selectedVersion.MaxYear
                              ? selectedVersion.MinYear
                              : `${selectedVersion.MinYear} - ${selectedVersion.MaxYear}`}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <FileText className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Комментарий</div>
                          <div 
                            className="text-sm font-medium text-gray-900 truncate max-w-[250px]"
                            title={selectedVersion.Comment || 'Нет комментария'}
                          >
                            {selectedVersion.Comment && selectedVersion.Comment.length > 50
                              ? `${selectedVersion.Comment.substring(0, 50)}...`
                              : selectedVersion.Comment || 'Нет комментария'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Hash className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Общий план</div>
                          <div className="text-sm font-medium text-gray-900">
                            {analyticsLoading ? '...' : (analytics?.total_qty?.toLocaleString('ru-RU') || '0')}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Статус */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Статус:</span>
                      {selectedVersion.IsActive ? (
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                          Активная версия
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                          Неактивная
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Аналитика */}
                {analytics && (
                  <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                    {/* По Market */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">По рынкам</h4>
                      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Market</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">QTY</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analytics.by_market?.map((row: any, idx: number) => (
                              <tr key={idx} className="border-b last:border-b-0">
                                <td className="px-3 py-2 text-gray-900">{row.Market}</td>
                                <td className="px-3 py-2 text-right font-medium text-gray-900">
                                  {row.QTY?.toLocaleString('ru-RU')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* По LargeGroup */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">По группам</h4>
                      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Large Group</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">QTY</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analytics.by_largegroup?.map((row: any, idx: number) => (
                              <tr key={idx} className="border-b last:border-b-0">
                                <td className="px-3 py-2 text-gray-900">{row.LargeGroup}</td>
                                <td className="px-3 py-2 text-right font-medium text-gray-900">
                                  {row.QTY?.toLocaleString('ru-RU')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <FileSpreadsheet className="w-16 h-16 mx-auto mb-3 opacity-50" />
                  <p className="text-lg">Выберите версию из списка</p>
                  <p className="text-sm mt-1">для просмотра деталей</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

