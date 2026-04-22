import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { FieldDefinition, FieldRow, TaskFieldData } from '../hooks/useCustomFields';
import TaskManagerTranslation from '../TaskManagerTranslation.json';

interface CustomFieldsRendererProps {
  taskId: number;
  projectId?: number;
  fieldData: TaskFieldData;
  projectFields: Array<{
    id: number;
    field_name: string;
    field_type: string;
    field_options?: string;
    is_required: boolean;
    is_active: boolean;
  }>;
  /** Вызывается при каждом изменении строк — для валидации и сохранения */
  onRowsChange?: (rows: FieldRow[]) => void;
  /** @deprecated используйте onRowsChange */
  onValuesChange?: (values: Record<number, string>) => void;
  variant?: 'sidebar' | 'table';
}

export const CustomFieldsRenderer: React.FC<CustomFieldsRendererProps> = ({
  taskId,
  projectId,
  fieldData,
  projectFields,
  onRowsChange,
  onValuesChange,
  variant = 'sidebar',
}) => {
  const { t, i18n } = useTranslation('taskManager');
  const [rows, setRows] = useState<FieldRow[]>([]);

  React.useEffect(() => {
    const currentLang = i18n.language;
    if (TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation]) {
      i18n.addResourceBundle(currentLang, 'taskManager', TaskManagerTranslation[currentLang as keyof typeof TaskManagerTranslation], true, true);
    }
  }, [i18n]);

  // Эффективные определения полей: при create mode берём из проекта
  const effectiveFields: FieldDefinition[] = taskId === 0
    ? projectFields.filter(f => f.is_active).map(f => ({
        field_id: f.id,
        field_name: f.field_name,
        field_type: f.field_type,
        field_options: f.field_options,
        is_required: f.is_required,
      }))
    : fieldData.fields;

  // Синхронизируем локальное состояние при загрузке данных с сервера
  useEffect(() => {
    if (fieldData.rows.length > 0) {
      setRows(fieldData.rows.map(r => ({ ...r, values: { ...r.values } })));
    } else if (effectiveFields.length > 0 && rows.length === 0) {
      // Нет данных — одна пустая строка
      setRows([{ row_index: 0, values: {} }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldData, effectiveFields.length]);

  // Уведомляем родителя при любом изменении
  useEffect(() => {
    if (onRowsChange) onRowsChange(rows);
    // Обратная совместимость: передаём значения первой строки
    if (onValuesChange && rows.length > 0) {
      onValuesChange(rows[0].values as Record<number, string>);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const updateCell = (rowIdx: number, fieldId: number, value: string) => {
    setRows(prev => prev.map((r, i) =>
      i === rowIdx ? { ...r, values: { ...r.values, [fieldId]: value } } : r
    ));
  };

  const addRow = () => {
    const nextIndex = rows.length > 0 ? Math.max(...rows.map(r => r.row_index)) + 1 : 0;
    setRows(prev => [...prev, { row_index: nextIndex, values: {} }]);
  };

  const removeRow = (rowIdx: number) => {
    if (rows.length <= 1) return;
    setRows(prev => prev.filter((_, i) => i !== rowIdx));
  };

  const renderCell = (field: FieldDefinition, rowIdx: number) => {
    const value = (rows[rowIdx]?.values as Record<number, string>)?.[field.field_id] || '';
    const base = 'w-full px-2 py-1 bg-transparent border-0 outline-none focus:ring-0 text-sm text-gray-800 placeholder:text-gray-400 min-w-[80px]';

    switch (field.field_type) {
      case 'text':
      case 'number':
        return (
          <input
            type={field.field_type}
            value={value}
            onChange={e => updateCell(rowIdx, field.field_id, e.target.value)}
            className={base}
            placeholder={field.is_required ? '—' : ''}
          />
        );
      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={e => updateCell(rowIdx, field.field_id, e.target.value)}
            className={base}
          />
        );
      case 'select': {
        const options = field.field_options ? JSON.parse(field.field_options) : [];
        return (
          <select
            value={value}
            onChange={e => updateCell(rowIdx, field.field_id, e.target.value)}
            className={base}
          >
            <option value="">—</option>
            {options.map((opt: string, i: number) => (
              <option key={i} value={opt}>{opt}</option>
            ))}
          </select>
        );
      }
      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={e => updateCell(rowIdx, field.field_id, e.target.checked ? 'true' : 'false')}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
        );
      default:
        return null;
    }
  };

  const fields = effectiveFields;
  if (fields.length === 0) return null;

  /* ── TABLE variant (основной) ── */
  if (variant === 'table') {
    return (
      <div className="mt-2">

        <div className="border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full border-collapse text-sm" style={{ minWidth: `${fields.length * 120 + 40}px` }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {fields.map(f => (
                  <th
                    key={f.field_id}
                    className="px-3 py-2 text-left font-medium text-gray-500 text-xs whitespace-nowrap border-r border-gray-200 last:border-r-0"
                    style={{ minWidth: '120px' }}
                  >
                    {f.field_name}
                    {f.is_required && <span className="text-red-500 ml-0.5">*</span>}
                  </th>
                ))}
                {/* Колонка для кнопки удаления строки */}
                <th className="border-l border-gray-200 bg-gray-50 px-1 text-center" style={{ width: '40px', minWidth: '40px' }}>
                  <Trash2 className="w-3 h-3 text-gray-300 mx-auto" />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={row.row_index} className="border-t border-gray-100 first:border-t-0 hover:bg-gray-50/50 group">
                  {fields.map(f => (
                    <td key={f.field_id}
                      className="px-2 py-1 border-r border-gray-200 last-of-type:border-r-0 align-middle">
                      {renderCell(f, rowIdx)}
                    </td>
                  ))}
                  <td className="px-1 text-center border-l border-gray-200 align-middle" style={{ width: '40px', minWidth: '40px' }}>
                    {rows.length > 1 && (
                      <button
                        onClick={() => removeRow(rowIdx)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-300 hover:text-red-400 transition-all"
                        title={t('taskModalDeleteRow')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          onClick={addRow}
          className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 transition-colors px-1"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('taskModalAddRow')}
        </button>
      </div>
    );
  }

  /* ── SIDEBAR variant (старый вертикальный вид, только первая строка) ── */
  return (
    <div className="space-y-4 pt-4 border-t">
      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
        {t('taskModalAdditionalFields')}
      </h4>
      {fields.map(f => (
        <div key={f.field_id}>
          <label className="block text-xs font-medium text-gray-600 mb-1.5 uppercase tracking-wide">
            {f.field_name}
            {f.is_required && <span className="text-red-600 ml-1">*</span>}
          </label>
          {renderCell(f, 0)}
        </div>
      ))}
    </div>
  );
};
