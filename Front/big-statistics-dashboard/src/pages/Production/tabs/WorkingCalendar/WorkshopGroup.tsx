import React, { useMemo, memo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import { WorkshopGroupProps } from './types';
import WorkCenterAssignmentRow from './WorkCenterAssignmentRow';

const WorkshopGroup: React.FC<WorkshopGroupProps> = ({
  workshop,
  assignments,
  workCenters,
  workSchedules,
  onAddAssignment,
  onUpdateAssignment,
  onRemoveAssignment,
  getExistingWorkCenterIds,
  invalidAssignmentIds,
  emptyWorkCenterIds
}) => {
  const { t } = useTranslation('production');

  // Фильтруем РЦ только для этого цеха
  const workshopWorkCenters = workshop === 'undefined' 
    ? workCenters // Для undefined группы показываем все РЦ
    : workCenters.filter(wc => wc.workshop === workshop);

  // Фильтруем графики только для этого цеха
  const workshopWorkSchedules = useMemo(() => {
    if (workshop === 'undefined') {
      return workSchedules; // Для undefined группы показываем все графики
    }
    
    // Находим ID цеха по названию
    const workshopWorkCenter = workCenters.find(wc => wc.workshop === workshop);
    if (!workshopWorkCenter) {
      return workSchedules; // Если не нашли, показываем все
    }
    
    // Извлекаем ID цеха из ID рабочего центра (формат: workshopId_workCenterId)
    const workshopId = workshopWorkCenter.id.split('_')[0];
    
    // Фильтруем графики по ID цеха
    return workSchedules.filter(schedule => {
      return schedule.workshopId === workshopId;
    });
  }, [workshop, workSchedules, workCenters]);

  return (
    <div className="border border-gray-200 rounded-lg mb-4">
      {/* Заголовок цеха */}
      <div className="bg-gray-100 px-3 py-2 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">
            {workshop === 'undefined' ? 'Неопределенные назначения' : workshop}
          </h3>
          <button
            onClick={() => onAddAssignment(workshop)}
            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors flex items-center space-x-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>{t('addAssignment')}</span>
          </button>
        </div>
      </div>

      {/* Содержимое группы */}
      <div className="p-3">
        {assignments.length === 0 ? (
          <div className="text-center py-3 text-gray-500 text-sm">
            {t('noAssignments')}
          </div>
        ) : (
          (() => {
            // Виртуализация при длинных списках
            if (assignments.length < 30) {
              return (
                <div className="space-y-0">
                  {assignments.map((assignment, index) => (
                    <div key={assignment.id} className={`${emptyWorkCenterIds?.has(assignment.id) || invalidAssignmentIds?.has(assignment.id) ? 'ring-1 ring-red-400 rounded' : ''}`}>
                      <WorkCenterAssignmentRow
                        assignment={assignment}
                        workCenters={workshopWorkCenters}
                        workSchedules={workshopWorkSchedules}
                        onUpdate={onUpdateAssignment}
                        onRemove={onRemoveAssignment}
                        existingWorkCenterIds={getExistingWorkCenterIds(assignment.id)}
                        showHeader={index === 0}
                        isFirstRow={index === 0}
                        isDuplicate={Boolean(invalidAssignmentIds?.has(assignment.id))}
                        isEmptyWorkCenter={Boolean(emptyWorkCenterIds?.has(assignment.id))}
                      />
                      {(emptyWorkCenterIds?.has(assignment.id) || invalidAssignmentIds?.has(assignment.id)) && (
                        <div className="px-2 py-1 text-xs text-red-600 bg-red-50 border-t border-red-200">
                          {emptyWorkCenterIds?.has(assignment.id) ? t('assignmentValidation.workCenterRequired') : t('assignmentValidation.duplicateAssignment')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            }

            const parentRef = useRef<HTMLDivElement | null>(null);
            const rowVirtualizer = useVirtualizer({
              count: assignments.length,
              getScrollElement: () => parentRef.current,
              estimateSize: () => 48,
              overscan: 8,
              measureElement: (el) => el?.getBoundingClientRect().height || 48,
            });
            const items = rowVirtualizer.getVirtualItems();
            return (
              <div ref={parentRef} className="space-y-0 max-h-[480px] overflow-auto relative">
                <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
                  {items.map(vi => {
                    const assignment = assignments[vi.index];
                    return (
                      <div
                        key={assignment.id}
                        ref={rowVirtualizer.measureElement}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vi.start}px)` }}
                        className={`${emptyWorkCenterIds?.has(assignment.id) || invalidAssignmentIds?.has(assignment.id) ? 'ring-1 ring-red-400 rounded' : ''}`}
                      >
                        <WorkCenterAssignmentRow
                          assignment={assignment}
                          workCenters={workshopWorkCenters}
                          workSchedules={workshopWorkSchedules}
                          onUpdate={onUpdateAssignment}
                          onRemove={onRemoveAssignment}
                          existingWorkCenterIds={getExistingWorkCenterIds(assignment.id)}
                          showHeader={vi.index === 0}
                          isFirstRow={vi.index === 0}
                          isDuplicate={Boolean(invalidAssignmentIds?.has(assignment.id))}
                          isEmptyWorkCenter={Boolean(emptyWorkCenterIds?.has(assignment.id))}
                        />
                        {(emptyWorkCenterIds?.has(assignment.id) || invalidAssignmentIds?.has(assignment.id)) && (
                          <div className="px-2 py-1 text-xs text-red-600 bg-red-50 border-t border-red-200">
                            {emptyWorkCenterIds?.has(assignment.id) ? t('assignmentValidation.workCenterRequired') : t('assignmentValidation.duplicateAssignment')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
};

export default memo(WorkshopGroup);
